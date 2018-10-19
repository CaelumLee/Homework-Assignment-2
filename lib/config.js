/*
*create and export configuration variables  
*
*/

//container for all the environments
var environments = {};

//staging (default) environment
environments.staging = {
    'httpPort' : 3000,
    'httpsPort' : 3001,
    'envName' : 'staging',
    'hashingSecret' : 'myPasswordtolol',
    'stripeConfig' : {
        'SecretID' : 'sk_test_dopczfHan4T2BuDc08hnaG6A',
    },
    'mailgunConfig' : {
        'SecretAPI' : '78811221944d62383c4423ffef230abb-bd350f28-ba43a6ec',
        'Domain' : 'sandboxf0f1d33329f245ed8914beac13d35e9b.mailgun.org'
    }
};

//production environment
environments.production = {
    'httpPort' : 80,
    'httpsPort' : 443,
    'envName' : 'production',
    'hashingSecret' : 'wagKaNangUmasaPa'
};

//determine which environment was passed as a command-line argument
var currentEnvironment = typeof(process.env.NODE_ENV) == 'string' ? process.env.NODE_ENV.toLowerCase() : '';

//check that the current environment is one of the environments above, if not default to staging
var environmentToExport = typeof(environments[currentEnvironment]) == 'object' ? environments[currentEnvironment] : environments.staging;

//export the module
module.exports = environmentToExport;