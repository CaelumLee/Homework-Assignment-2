/*
*Stripe implementation
*
*/

//dependency
var https = require('https');
var querystring = require('querystring');
var config = require('./config');

//module for stripe
var stripe = {};

stripe.payment = function(amount, orderID ,callback){
    //configure the payload
    var payload = {
        'amount' : amount,
        'currency' : 'usd',
        'source' : 'tok_visa',
        'description' : 'Order for ' + orderID
    };
    
    var stringPayload = querystring.stringify(payload);

    //configure the request details
    var requestDetails = {
        'protocol' : 'https:',
        'auth' : config.stripeConfig.SecretID + ":" + config.stripeConfig.SecretID,
        'host' : 'api.stripe.com',
        'method' : 'POST',
        'path' : '/v1/charges',
        'headers' : {
            'Content-Type' : 'application/x-www-form-urlencoded',
            'Content-Length' : Buffer.byteLength(stringPayload)
        }
    }

    //instantiate the request object
    var req = https.request(requestDetails, function(res){
        //grab the status code of the sent request
        var status = res.statusCode;

        //if it's okay
        if(status == 200 || status == 201){
            callback(false);
        }
        else{
            console.log("Stripe unsuccessful");
            callback('Status code ' + status);
        }
    });

    //bind to the error event so it doesn't get thrown
    req.on('error', function(err){
        callback(err);
    });

    //add the payload
    req.write(stringPayload);

    //end the request
    req.end();
};



//module to export
module.exports = stripe;