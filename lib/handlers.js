/*
*Request handlers
*
*/

//dependencies
var _data = require('./data');
var helpers = require('./helpers');
var mailgun = require('./mailgun');
var stripe = require('./stripe');

//define the handlers
var handlers = {};

//regex for email
var regulateExpression = /^((([a-z]|\d|[!#\$%&'\*\+\-\/=\?\^_`{\|}~]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])+(\.([a-z]|\d|[!#\$%&'\*\+\-\/=\?\^_`{\|}~]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])+)*)|((\x22)((((\x20|\x09)*(\x0d\x0a))?(\x20|\x09)+)?(([\x01-\x08\x0b\x0c\x0e-\x1f\x7f]|\x21|[\x23-\x5b]|[\x5d-\x7e]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(\\([\x01-\x09\x0b\x0c\x0d-\x7f]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]))))*(((\x20|\x09)*(\x0d\x0a))?(\x20|\x09)+)?(\x22)))@((([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]))){2,6}$/i;

//not found handler
handlers.notFound = function(data, callback){
    callback(404);
};

//ping handler
handlers.ping = function(data, callback){
    callback(200);
};

handlers.users = function(data, callback){
    //list out the acceptable methods
    var acceptableMethods = ['post', 'get', 'put', 'delete'];
    if(acceptableMethods.indexOf(data.method) > -1){
        handlers._users[data.method](data, callback);
    }
    else{
        callback(405);
    }
};

//container for the users submethods
handlers._users = {};

//users - post
//required data: first name, last name, email, password, tosAgreement
//optional data : none
handlers._users.post = function(data, callback){
    //check that all required fields are filled out
    var firstName = typeof(data.payload.firstName) == 'string' && data.payload.firstName.trim().length > 0 ? data.payload.firstName.trim() : false;
    var lastName = typeof(data.payload.lastName) == 'string' && data.payload.lastName.trim().length > 0? data.payload.lastName.trim() : false;
    var email = typeof(data.payload.email) == 'string' && data.payload.email.trim().length > 0 && regulateExpression.test(data.payload.email.trim()) == true? data.payload.email.trim() : false;
    var password = typeof(data.payload.password) ==  'string' && data.payload.password.trim().length > 0 ? data.payload.password.trim() : false;
    var tosAgreement = typeof(data.payload.tosAgreement) == 'boolean' && data.payload.tosAgreement == true ? true : false;

    if(firstName && lastName && password && tosAgreement){
        if(email){
            //make sure that the user doesn't already exist
            _data.read('users', email, function(err, data){
                if(err){
                    //hash the password
                    var hashedPassword = helpers.hash(password);
                    if(hashedPassword){
                        //creating the user object
                        var userObject = {
                            'firstName' : firstName,
                            'lastName' : lastName,
                            'email' : email,
                            'password' : hashedPassword,
                            'tosAgreement' : true
                        };

                        //store the user
                        _data.create('users', email, userObject, function(err){
                            if(!err){
                                callback(200);
                            }
                            else{
                                console.log(err);
                                callback(500, {"Error" : "A user with that email address already exists"});
                            }
                        });
                    }
                    else{
                        callback(500, {"Error": "Could not hash the user's password"})
                    }
                }
                else{
                    //user already exist
                    callback(400, {"Error" : "User with that email address already exists"});
                }
            });
        }
        else{
            callback(400, {"Error" : "Incorrect email format"})
        }
    }
    else{
        callback(400, {"Error" : "Missing required fields"});
    };
};

//users - get
//required data : email
//optional data : none
handlers._users.get = function(data, callback){
    //check that their email is valid
    var email = typeof(data.queryStringObject.email) == 'string' && data.queryStringObject.email.trim().length > 0 ? data.queryStringObject.email.trim() : false;
    if(email){
        //get the token from the headers
        var token = typeof(data.headers.token) == 'string' ? data.headers.token : false;
        
        //verify that the given token is valid for the email
        handlers._tokens.verifyToken(token, email, function(tokenIsValid){
            if(tokenIsValid){
                //lookup the user
                _data.read('users', email, function(err, data){
                    if(!err && data){
                        //remove the hashed password from the user object before returning to the requestor
                        delete data.password;
                        callback(200, data);
                    }
                    else{
                        callback(404);
                    }
                });
            }
            else{
                callback(403, {"Error" : "Missing required token in header, or token is invalid"});
            }
        });
    } 
    else{
        callback(400, {"Error" : "Missing required data"});
    }
};

//users - put
//required data: email
//optional data: firstName, LastName, password (at least one must be specified)
handlers._users.put = function(data, callback){
    //check the required field
    var email = typeof(data.payload.email) == 'string' && data.payload.email.trim().length > 0 && regulateExpression.test(data.payload.email.trim()) == true? data.payload.email.trim() : false;

    //check for optional field
    var firstName = typeof(data.payload.firstName) == 'string' && data.payload.firstName.trim().length > 0 ? data.payload.firstName.trim() : false;
    var lastName = typeof(data.payload.lastName) == 'string' && data.payload.lastName.trim().length > 0? data.payload.lastName.trim() : false;
    var password = typeof(data.payload.password) ==  'string' && data.payload.password.trim().length > 0 ? data.payload.password.trim() : false;
    if(email){

        //get the token from the headers
        var token = typeof(data.headers.token) == 'string' ? data.headers.token : false;
        
        //verify that the given token is valid for the email
        handlers._tokens.verifyToken(token, email, function(tokenIsValid){
            if(tokenIsValid){
                if(firstName || lastName || password){
                    //lookup the user
                    _data.read('users', email, function(err, userData){
                        if(!err && userData){
                            //update the fields that are necessary
                            if(firstName){
                                userData.firstName = firstName
                            }
                            if(lastName){
                                userData.lastName = lastName
                            }
                            if(password){
                                userData.password = helpers.hash(password);
                            }
                            
                            //store the new updates
                            _data.update('users', email, userData, function(err){
                                if(!err){
                                    callback(200);
                                }
                                else{
                                    console.log(err);
                                    callback(500, {"Error" : "Could not update the user"});
                                }
                            });
                        }  
                        else{
                            callback(400, {"Error" : "The specified user does not exist"})
                        }
                    });
                }
                else{
                    callback(400, {"Error" : "Missing fields to update"});
                }
            }
            else{
                callback(403, {"Error" : "Missing required token in header, or token is invalid"});
            }
        });
    }
    else{
        callback(400, {"Error" : "Missing required fields"});
    }
};

//users - delete
//required data: email
//optional data: none
handlers._users.delete = function(data, callback){
     //check that their email is valid
     var email = typeof(data.queryStringObject.email) == 'string' && data.queryStringObject.email.trim().length > 0 ? data.queryStringObject.email.trim() : false;
    
     if(email){
        //get the token from the headers
        var token = typeof(data.headers.token) == 'string' ? data.headers.token : false;
        
        //verify that the given token is valid for the email
        handlers._tokens.verifyToken(token, email, function(tokenIsValid){
            if(tokenIsValid){    
                //lookup the user
                _data.read('users', email, function(err, userData){
                    if(!err && userData){
                        _data.delete('users', email, function(err){
                            if(!err){
                                callback(200);
                            }
                            else{
                                callback(500, {"Error" : "Could not delete the specified user"});
                            }
                        })
                    }
                    else{
                        callback(400, {"Error" : "Could not find the specified user"});
                    }
                });
            }
            else{
                callback(403, {"Error" : "Missing required token in header, or token is invalid"});
            }
        });
     }
     else{
         callback(400, {"Error" : "Missing required fields"});
     }
};

handlers.tokens = function(data, callback){
    //list out the acceptable methods
    var acceptableMethods = ['post', 'get', 'put', 'delete'];
    if(acceptableMethods.indexOf(data.method) > -1){
        handlers._tokens[data.method](data, callback);
    }
    else{
        callback(405);
    }
};

//container for the tokens submethods
handlers._tokens = {};

//tokens - post
//required data : email, password
//optional data : none
handlers._tokens.post = function(data, callback){
    var email = typeof(data.payload.email) == 'string' && data.payload.email.trim().length > 0 && regulateExpression.test(data.payload.email.trim()) == true? data.payload.email.trim() : false;
    var password = typeof(data.payload.password) ==  'string' && data.payload.password.trim().length > 0 ? data.payload.password.trim() : false;
    if(email && password){
        //lookup the user who matches that email
        _data.read('users', email, function(err, userData){
            if(!err && userData){
                //hash the sent password and compare it to the password stored in the user object
                var hashedPassword = helpers.hash(password);
                if(hashedPassword == userData.password){
                    //if valid, create new token with random name. Set expiration date 1 hour to the future.
                    var tokenId = helpers.createRandomString(20);
                    var expires = Date.now() + 1000 * 60 * 60;
                    var tokenObject = {
                        'email'  : email,
                        'id' : tokenId,
                        'expires' : expires
                    };

                    //store the token
                    _data.create('tokens', tokenId, tokenObject, function(err){
                        if(!err){
                            callback(200, tokenObject);
                        }
                        else{
                            callback(500, {"Error" : "Could not create new token"});
                        }
                    })
                }
                else{
                    callback(400, {"Error" : "Password did not match the specified user's stored password"});
                }
            }
            else{
                callback(400, {"Error" : "Could not find the specified user"});
            }
        });
    }
    else{
        callback(400, {"Error" : "Missing required fields"});
    }
};

//tokens - get
//required data : id 
//optional data : none
handlers._tokens.get = function(data, callback){
    //check for the id is valid
    var id = typeof(data.queryStringObject.id) == 'string' && data.queryStringObject.id.trim().length == 20 ? data.queryStringObject.id.trim() : false;
    if(id){
        //lookup the token
        _data.read('tokens', id, function(err, tokenData){
            if(!err){
                callback(200, tokenData);
            }
            else{
                callback(404);
            }
        });
    }
    else{
        callback(400, {"Error" : "Missing required fields"});
    }
};

//tokens - put
//required fields : id, extend
//optional data : none
handlers._tokens.put = function(data, callback){
    var id = typeof(data.payload.id) == 'string' && data.payload.id.trim().length == 20 ? data.payload.id.trim() : false;
    var extend = typeof(data.payload.extend) ==  'boolean' && data.payload.extend ==  true ? true : false;
    if(id && extend){
        //lookup the token
        _data.read('tokens', id, function(err, tokenData){
            if(!err && tokenData){
                //check to make sure the token isn't already expired
                if(tokenData.expires > Date.now()){
                    //set the expiration an hour from now
                    tokenData.expires = Date.now() * 1000 * 60 * 60;

                    //store the new update
                    _data.update('tokens', id, tokenData, function(err){
                        if(!err){
                            callback(200);
                        }
                        else{
                            callback(500, {"Error" : "Could not update the token's expiration"});
                        }
                    });
                }
                else{
                    callback(400, {"Error" : "The token has already expired and cannot be extend"});
                }
            }
            else{
                callback(400, {"Error" : "Specified token does not exist"});
            }
        });
    }
    else{
        callback(400, {"Error" : "Missing required field(s) or field(s) are invalid"});
    }
};

//tokens - delete
//required data : id
//optional data : none
handlers._tokens.delete = function(data, callback){
  //check that their email is valid
  var id = typeof(data.queryStringObject.id) == 'string' && data.queryStringObject.id.trim().length == 20 ? data.queryStringObject.id.trim() : false;
  if(id){
     //lookup the tokens
     _data.read('tokens', id, function(err, tokenData){
         if(!err && tokenData){
             _data.delete('tokens', id, function(err){
                 if(!err){
                     callback(200);
                 }
                 else{
                     callback(500, {"Error" : "Could not delete the specified token"});
                 }
             })
         }
         else{
             callback(400, {"Error" : "Could not find the specified token"});
         }
     });
  }
  else{
      callback(400, {"Error" : "Missing required fields"});
  }
};

//verify if a given token id is currently valid for a given user
handlers._tokens.verifyToken = function(id, email, callback){
    //lookup the token
    _data.read('tokens', id, function(err, tokenData){
        if(!err && tokenData){
            //check that the token is for the given user and has not expired
            if(tokenData.email == email && tokenData.expires > Date.now()){
                callback(true);
            }
            else{
                callback(false);
            }
        }
        else{
            callback(false);
        }
    })
};

handlers.orders = function(data, callback){
    //list out the acceptable methods
    var acceptableMethods = ['post', 'get', 'put', 'delete'];
    if(acceptableMethods.indexOf(data.method) > -1){
        handlers._orders[data.method](data, callback);
    }
    else{
        callback(405);
    }
};

//container for the orders submethods
handlers._orders = {};

//orders - post
//required data : Pizza ID, quantity, email
//optional data : none
handlers._orders.post = function(data, callback){
    //check that the id and quantity is valid
    var email = typeof(data.payload.email) == 'string' && data.payload.email.trim().length > 0 && regulateExpression.test(data.payload.email.trim()) == true? data.payload.email.trim() : false;
    var orders = typeof(data.payload.orders) == 'object' ? data.payload.orders : false;

    if(email && orders){
        //get the token from the headers
        var token = typeof(data.headers.token) == 'string' ? data.headers.token : false;
            
        //verify that the given token is valid for the email
        handlers._tokens.verifyToken(token, email, function(tokenIsValid){
            if(tokenIsValid){
                //lookup the menu file
                _data.read('', 'menu', function(err, menuData){
                    if(!err && menuData){
                        //go through the menuData
                        var total = 0;
                        var errCount = 0;

                        //this will serve as the table outpu for mailgun showcasing the items, quantity, price, and total from the order of user
                        var table = "<table style='width:100%'><tr><th>Item</th> <th>Quantity</th> <th>Price</th> </tr>";

                        //object for orders
                        var ordersObject = {};
                        Object.keys(orders).forEach(function(key, i){
                            //check if the user has input from orders table
                            //sorry for the long statement, just want to make sure that I'm getting the correct value
                            var id = typeof(orders[key]['id']) == 'string' &&  orders[key]['id'].charAt(0) == 'P' && typeof(parseInt(orders[key]['id'].charAt(1))) == 'number' &&  parseInt(orders[key]['id'].charAt(1)) > 0 && parseInt(orders[key]['id'].charAt(1)) < 6 ? orders[key]['id'] : false;
                            var quantity = typeof(orders[key]['quantity']) == 'number' && orders[key]['quantity'] > 0 ? orders[key]['quantity'] : false;
                            if(id && quantity){
                                 //set the pizzaID from the payload, from orders object
                                var pizzaID = id;
                                table += "<tr>";

                                //get the pizza name from menuData
                                var pizzaName = menuData[pizzaID]['name'];
                                table += "<td>" + pizzaName + "</td>";
                                table += "<td>" + quantity + "</td>";

                                //get the price from menuData
                                var origprice = menuData[pizzaID]['price'];

                                //parse it because it is string by default
                                var trimmedprice = parseInt(origprice.substring(1).replace('.', ''));

                                //multiply the price to the given quantity
                                trimmedprice *= quantity;
                                total += trimmedprice;

                                //amount for price times quantity
                                trimmedprice = "$" + trimmedprice.toString().substring(0, trimmedprice.toString().length - 2) + '.' + trimmedprice.toString().substr(-2);
                                table += "<td>" + trimmedprice + "</td>";
                                table += "</tr>"
                                var orderNum = i + 1;
                                //creating new property for orders object with the current order
                                ordersObject['orderNum' + orderNum] = {
                                    "name" : pizzaName,
                                    "quantity" : quantity,
                                    "Original price" : origprice,
                                    "Amount" : trimmedprice
                                };
                            }
                            else{
                                errCount++;
                            }
                        });
                        //check if there is error before continuing
                        if(errCount > 0){
                            callback(400, {"Error" : "Wrong input in one of the fields"});
                        }
                        else{
                            var orderID = helpers.createRandomString(10);
                            ordersObject['Order ID'] =orderID;
                            //pay using stripe api
                            stripe.payment(total, orderID ,function(err){
                               if(!err){
                                //sending an email with details about the order
                                total = "$" + total.toString().substring(0, total.toString().length - 2) + '.' + total.toString().substr(-2);
                                
                                //new property of total for orders object
                                ordersObject['Total'] = total;
                                table += "<td>Total</td><td></td><td>" + total + "</td>";
                                table += "</table>";
                                var subject = "Order details for " + orderID;
                                var text = "Hello!!! You have purchashed with an order ID of " + orderID + "!" + 
                                "<br><br> Here's the summary of your order:<br><br>"; 
                                mailgun.send(email, subject, text, table ,function(err){
                                    if(err){
                                        //create a order file in orders folder
                                        _data.create('orders', orderID, ordersObject, function(err){
                                            if(!err){
                                                callback(200, ordersObject);
                                            }
                                            else{
                                                callback(500, {"Error" : "Could not create a new order file"});
                                            }
                                        });
                                    }
                                    else{
                                        callback(500, {"Error" : "Cannot send email"});
                                    }
                                });
                               } 
                               else{
                                callback(500, {"Error" : "Cannot finish transaction"});
                               }
                            });
                        }
                    }
                    else{
                        callback(400, {"Error" : "Cannot find the menu file"});
                    }
                });
            }
            else{
                callback(403, {"Error" : "Missing required token in header, or token is invalid"});
            }
        }); 
    }
    else{
        callback(400, {"Error" : "Missing required fields"});
    }
};

//orders - get
//required data : none
//optional data : none
handlers._orders.get = function(data, callback){
    //lookup the menu file
    _data.read('', 'menu', function(err, menuData){
        if(!err && menuData){
            callback(200, menuData);
        }
        else{
            callback(400, {"Error" : "Cannot find the menu file"});
        }
    });
}

//export module
module.exports = handlers;