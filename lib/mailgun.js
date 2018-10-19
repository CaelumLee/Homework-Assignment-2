/*
*Mailgun implementation
*
*/

//Dependency
var https = require('https');
var querystring = require('querystring');
var config = require('./config');

//module for mailgun
var mailgun = {};

mailgun.send = function(to, subject, text, table ,callback){
    //configure the request payload
    var payload = {
        'from' : 'me@samples.mailgun.org',
        'to' : to,
        'subject' : subject,
        'text' : text,
        'html' : text + table
    }
    var stringPayload = querystring.stringify(payload);

    //configure the request details
    var requestDetails = {
        'protocol' : 'https:',
        'auth' : 'api:' + config.mailgunConfig.SecretAPI,
        'host' : 'api.mailgun.net',
        'method': 'POST',
        'path': '/v3/' + config.mailgunConfig.Domain + '/messages',
        'headers': {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(stringPayload)
        }
    };

    //instantiate the request object
    var req = https.request(requestDetails, function(res){
        //grab the status code of the sent request
        var status = res.statusCode;

        //if it's okay
        if (status == 200 || status == 201) {
            callback(status);
        } 
        else {
        console.log('Mailgun unsuccessful');
        callback('Status code: ' + status);
        }
    })

    //bind to the error event so it doesn't get thrown
    req.on('error', function(){
        callback(e);
    });
    
    // Add the payload
    req.write(stringPayload);

    // End the request
    req.end();
};

//export the module
module.exports = mailgun;