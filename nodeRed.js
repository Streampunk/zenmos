var http = require('http');
var express = require('express');
var RED = require('node-red');

function createNodeRed(audit, registration) {
  console.log('Starting Node-RED');

  // Create an Express app
  var app = express();

  // Add a simple route for static content served from 'public'
  app.use('/',express.static('public'));

  // Create a server
  var server = http.createServer(app);

  // Create the settings object - see default settings.js file for other options
  var settings = {
    httpAdminRoot: '/red',
    httpNodeRoot: '/api',
    userDir: 'reduser',
    nodesDir: 'nodes',
    functionGlobalContext: {
      audit: audit,
      registration: registration
    },
    paletteCategories: ['zenmos', 'input', 'output', 'function', 'social', 'storage', 'analysis', 'advanced'],
    logging: { console : { level : 'warn', audit : false } }
  };

  // Initialise the runtime with a server and settings
  RED.init(server,settings);

  // Serve the editor UI from /red
  app.use(settings.httpAdminRoot,RED.httpAdmin);

  // Serve the http nodes UI from /api
  app.use(settings.httpNodeRoot,RED.httpNode);

  server.listen(8000);

  // Start the runtime
  RED.start();
}

export default createNodeRed;