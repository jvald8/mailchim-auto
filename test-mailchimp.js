require('dotenv').config();

console.log({"available variables: ": process.env});

var fs = require('fs');
var request = require('superagent');
var json2csv = require('json2csv');
var moment = require('moment');
var email = require('emailjs/email');
var server = email.server.connect({
  user: process.env.MAIL_SERVER_USER,
  password: process.env.MAIL_SERVER_PASSWORD,
  host:'smtp.gmail.com',
  ssl:true
});

var todaysDate = moment().format('MM-DD-YYYY');

var mailChimpAPIKey = process.env.MAILCHIMP_API_KEY;

var listId = process.argv[2];

request
  .get(`http://us13.api.mailchimp.com/3.0/lists/${listId}`)
  .set('Content-Type', 'application/json;charset=utf-8')
  .set('Authorization', 'Basic ' + new Buffer(`anystring:${mailChimpAPIKey}`).toString('base64'))
  .end(function(err, res){
     if (err || !res.ok) {
       console.log(`error pulling list member count:${err}`)
     } else {

      var listName = res.body.name.replace(/ /g, '-');

      var listMemberCount = JSON.stringify(res.body.stats.member_count);

      request
         .get(`http://us13.api.mailchimp.com/3.0/lists/${listId}/members?count=${listMemberCount}&status=subscribed&fields=members.email_address,members.merge_fields,members.timestamp_signup,members.timestamp_opt`)
         .set('Content-Type', 'application/json;charset=utf-8')
         .set('Authorization', 'Basic ' + new Buffer(`anystring:${mailChimpAPIKey}`).toString('base64'))
         .end(function(err, res){
           if (err || !res.ok) {
             console.log(`error pulling list member count:${err}`);
           } else {

            var members = res.body.members;
            console.log(members)

            var newArray = [];

            for(i = 0; i < members.length; i++) {
              if(members[i].merge_fields.FNAME) {
                newArray.push(JSON.parse(`{"email_address":"` + members[i].email_address + `", "first_name":"` + members[i].merge_fields.FNAME + '", "last_name":"' + members[i].merge_fields.LNAME + '", "date-time-signup":"' + moment(members[i].timestamp_signup || members[i].timestamp_opt).format("MM/DD/YYYY HH:mm:ss") + '"}'))
              } else {
                newArray.push(JSON.parse(`{"email_address":"` + members[i].email_address + `", "first_name":"", "last_name":"", "date-time-signup":"` + moment(members[i].timestamp_signup || members[i].timestamp_signup).format("MM/DD/YYYY HH:mm:ss") + `"}`));
              }
            };

            var fields = ['email_address', 'first_name', 'last_name', 'date-time-signup'];

            var result = json2csv({data:newArray, fields:fields});

            fs.writeFile(process.env.HOME + `/mailchimp-auto/reports/${listName}-${todaysDate}.csv`, result, function(err) {
              if(err) throw err;

              console.log(`${listName}-${todaysDate}.csv saved`);

              server.send({
                text:`These are the ${listName} Submissions up until`,
                from: "jvald8@gmail.com",
                to: "kbenetz@ehy.com, jringvald@ehy.com",
                subject:`${listName} Submissions ${todaysDate}`,
                attachment:
                  [
                    {data:`<html>This is a csv file of ${listName} in Mailchimp up until ${todaysDate} <br> </html>`, alternative: true},
                    {path:process.env.HOME + `/mailchimp-auto/reports/${listName}-${todaysDate}.csv`, type:"application/csv", name:`${listName}-${todaysDate}.csv`}
                  ]
              }, function(err, message) {
                console.log(err || message)

              });
            });

           }
         });
     }
   });




