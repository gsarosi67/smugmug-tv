//var AWS = require('aws-sdk');
var https = require('https');
var http = require('http');

const APIKey = require('./sm_access.js').APIKey;  /* change this to use AWS Secrets Manager */

console.log("APIKey: " + JSON.stringify(APIKey));

var dataEndDate;

var default_options = {
    base_uri: 'api.smugmug.com',
    path: '/api/',
    api_version: 'v2',
    query: "?APIKey="+APIKey.key,
    headers: {
      'User-Agent' : 'x1Smug',
      'Accept' : 'application/json'
    },
    timeout: 30,
    auth: null
};

exports.handler = handler;

if (process.env.SMUGMUG_SERVICE_LOCAL != undefined) {
    var url = require('url');
    var levent = {};
    var i = 1;
    while (i < process.argv.length) {
      if (process.argv[i] == "-path") {
        levent.path = process.argv[++i];
      }
      else if (process.argv[i] == "-query") {
        levent.queryStringParameters = url.parse(process.argv[++i],true).query;
      }
      i++;
    }

    if (levent.path != undefined)
    {
       console.log("levent: " + JSON.stringify(levent));
       exports.handler(levent, null, function(event,response) {
              console.log("Response: " + JSON.stringify(response));
       });
    }
    else {
       console.error("Path undefined");
    }
}

//exports.handler = (event, context, callback) => {
function handler(event, context, callback) {
    var d = new Date();
    var q;
    var api;

    console.log(d.toLocaleString() + " : " + "event.resource= " + event.resource + " event.path= " + event.path);
    if (event.queryStringParameters != undefined) {
       console.log("queryStringParameters: ");
       console.log(JSON.stringify(event.queryStringParameters));
       q = event.queryStringParameters;
    }
    else {
      /* no api included, return error */
      console.log("Error: api undefined");
      callback(null,prepareresponse(404,'NO_CACHE',JSON.stringify({message: 'api undefined'})));
    }

    if (q['api'] != undefined) {
       api = q['api'];
    }
    else {
      /* no api included, return error */
      console.log("Error: api undefined");
      callback(null,prepareresponse(404,'NO_CACHE',JSON.stringify({message: 'api undefined'})));
    }

    /* generate the api path, add '/api/v#' is it doesn't exit
       always add the default query options
    */
    var apiPath;
    if (api.indexOf(default_options.path + default_options.api_version) === -1) {
       apiPath = default_options.path + default_options.api_version + "/" + api + default_options.query;
    }
    else {
       apiPath = api + default_options.query;
    }

    var options = {
      hostname: default_options.base_uri,
      path: apiPath,
      method: 'GET',
      headers: default_options.headers
    }

    for (var queryItem in q) {
        if (queryItem != 'api') {
           options.path += "&" + queryItem + "=" + q[queryItem];
        }
    }

    console.log("options: " + JSON.stringify(options));

    var req = https.request(options, (resp) => {
      let data = '';

      // A chunk of data has been recieved.
      resp.on('data', (chunk) => {
        data += chunk;
        //console.log("chunk: " + chunk);
      });

      // The whole response has been received. Print out the result.
      resp.on('end', () => {
        console.log(JSON.parse(data).explanation);

        /* return the result
             - Do I need to stringify?  but I think the data is already json
         */
        callback(null,prepareresponse(200,'DATA_EXPIRE',data));
      });
    });

    req.on("error", (err) => {
      console.log("Error: " + err.message);
      callback(null,prepareresponse(500,'NO_CACHE',JSON.stringify({message: err.message})));
    });

    req.end();
}

function prepareresponse(httpstatus,expType,data)
{
    var d = new Date();
    var expires = 0;
    if (expType == 'DATA_EXPIRE') {
      if (dataEndDate != undefined) {
          expires = Math.floor((dataEndDate.getTime() - d.getTime()) / 1000);
          if (expires < 0) expires = 0;  // just in case
      }
    }
    var response =
    {
      isBase64Encoded: false,
      headers: {
         'Content-Type' : 'application/json',
         'Access-Control-Allow-Origin' : '*',
         'Cache-Control' : 'max-age=' + expires  // 24 hours
      },
      statusCode: httpstatus,
      body: data
    };
    return(response);
}
