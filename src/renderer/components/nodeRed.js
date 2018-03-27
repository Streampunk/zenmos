const http = require('http');
const express = require('express');
const RED = require('node-red');
const fs = require('fs');
const os = require('os');
const path = require('path');

function createNodeRed(audit, registration) {
  const basePath = 'darwin' === os.platform() ? 
    path.join(process.env.HOME, 'Library', 'zenmos') :
    path.join(process.env.APPDATA, 'zenmos');
  const nodesPath = process.env.NODE_ENV !== 'development' ? 
    path.join(__dirname, '..', '..', 'nodes') : 
    'nodes';
  if (!fs.existsSync(basePath))
    fs.mkdirSync(basePath);
  console.log(`Starting Node-RED, user path: ${basePath}`);

  // Create an Express app
  var app = express();

  // Add a simple route for static content served from 'public'
  app.use('/',express.static('public'));

  // Create a server
  var server = http.createServer(app);

  // Create the settings object - see default settings.js file for other options
  var settings = {
    httpAdminRoot: '/',
    httpNodeRoot: '/',
    userDir: path.join(basePath, 'reduser'),
    nodesDir: nodesPath,
    functionGlobalContext: {
      audit: audit,
      registration: registration
    },
    paletteCategories: ['zenmos', 'input', 'output', 'function', 'social', 'storage', 'analysis', 'advanced'],
    logging: {
      console: {
        level: 'warn', 
        audit: false 
      },
      file: {
        level:'warn',
        metrics:false,
        handler: function() {
          const filename = path.join(basePath, 'NodeRED.log');
          fs.openSync(filename, 'w');
          return function(msg) {
            const logMsg = `${new Date(msg.timestamp).toLocaleTimeString('en-US')} ${msg.msg}${os.EOL}`;
            fs.appendFile(filename, logMsg, () => {});
          };
        }
      }
    }
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