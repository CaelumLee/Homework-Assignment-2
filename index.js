/*
* Primary File for the Pizza Company API
*
*/

// Dependencies
var http = require('http');
var https = require('https');
var url = require('url');
var StringDecoder = require('string_decoder').StringDecoder;
var config = require('./lib/config');
var fs = require('fs');
var _data = require('./lib/data');
var handlers = require('./lib/handlers');
var helpers = require('./lib/helpers');

// var mailgun = require('./lib/mailgun');
// mailgun.send('jaysonlee17@yahoo.com', 'testing', 'attention! Please<br><br>', function(err){
//     console.log(err);
// });

//instantiate the http server
var httpServer = http.createServer(function(req, res){
    unifiedServer(req, res);
});

//start the http server
httpServer.listen(config.httpPort, function(){
    console.log('The http server is listening on port '+ config.httpPort);
});

//instantiate the https server
var httpsServerOptions ={
    'key' : fs.readFileSync('./https/key.pem'),
    'cert' : fs.readFileSync('./https/cert.pem')
};
var httpsServer = https.createServer(httpsServerOptions, function(req, res){
    unifiedServer(req, res);
});

//start the https server
httpsServer.listen(config.httpsPort, function(){
    console.log('The https server is listening on port '+ config.httpsPort);
});

//all the server logic for both http and https server
var unifiedServer = function(req, res){
   //get the url and parse it
   var parsedUrl = url.parse(req.url, true);

   //get the path
   var path = parsedUrl.pathname;
   var trimmedPath = path.replace(/^\/+|\/+$/g,'');

   //get the query string as an object
   var queryStringObject = parsedUrl.query;

   //get the method
   var method = req.method.toLocaleLowerCase();

   //get the headers as an object
   var headers = req.headers;

   //get the payload from the body, if any
   var decoder = new StringDecoder('utf8');
   var buffer = '';
   req.on('data', function(data){
       buffer += decoder.write(data);
   });

   req.on('end', function(){
       buffer += decoder.end();

       //choose the handler this request should go to. If one is not found, use the not found handler
       var chosenHandler = typeof(router[trimmedPath]) !== 'undefined' ? router[trimmedPath] : handlers.notFound;
       
       //construct the date object to send to the handler
       var data = {
           'trimmedPath' : trimmedPath,
           'queryStringObject' : queryStringObject,
           'method' : method,
           'headers' : headers,
           'payload' : helpers.parseJsonToObject(buffer)
       };

       //route the request to the handler specified in the router
       chosenHandler(data, function(statusCode, payload){
           //use the status code called back by the handler, or default to 200
           statusCode = typeof(statusCode) == 'number' ? statusCode : 200;

           //use the payload called back by the handler, or default to an empty object
           payload = typeof(payload) == 'object' ? payload : {};

           //convert the payload to a string
           var payloadString = JSON.stringify(payload);

           //return the response
           res.setHeader('Content-Type', 'Application/json');
           res.writeHead(statusCode);
           res.end(payloadString);
           //log the request path
           console.log("We are returning this response: ",statusCode,payloadString);
       });
       
   });
};


//define a request router
var router = {
    'ping' : handlers.ping,
    'users' : handlers.users,
    'tokens' : handlers.tokens,
    'orders' : handlers.orders
};