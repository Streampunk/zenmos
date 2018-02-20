/* Copyright 2018 Streampunk Media Ltd.

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

const express = require('express');
const bodyParser = require('body-parser');

module.exports = function (RED) {

  function NMOSHTTPRequest (config) {
    RED.nodes.createNode(this, config);

    const app = express();
    app.use(bodyParser.json());

    app.get(config.base + ':api', (req, res) => {
      let msg = {
        type: 'HTTP GET',
        req: req,
        res: res,
        payload: req.query
      };
      this.send(msg);
    });

    app.get(config.base + ':api/:ver', (req, res) => {
      let msg = {
        type: 'HTTP GET',
        req: req,
        res: res,
        payload: req.query
      };
      this.send(msg);
    });

    app.get(config.base + ':api/:ver/(:resource|health/nodes)/:id?', (req, res) => {
      let msg = {
        type: 'HTTP GET',
        req: req,
        res: res,
        payload: req.query
      };
      this.send(msg);
    });

    app.post(config.base + ':api', (req, res) => {
      let msg = {
        type: 'HTTP POST',
        req: req,
        res: res,
        payload: req.body
      };
      this.send(msg);
    });

    app.post(config.base + ':api/:ver', (req, res) => {
      let msg = {
        type: 'HTTP POST',
        req: req,
        res: res,
        payload: req.body
      };
      this.send(msg);
    });

    app.post(config.base + ':api/:ver/(:resource|health/nodes)/:id?', (req, res) => {
      let msg = {
        type: 'HTTP POST',
        req: req,
        res: res,
        payload: req.body
      };
      this.send(msg);
    });

    app.delete(config.base + ':api', (req, res) => {
      let msg = {
        type: 'HTTP DELETE',
        req: req,
        res: res,
        payload: req.query
      };
      this.send(msg);
    });

    app.delete(config.base + ':api/:ver', (req, res) => {
      let msg = {
        type: 'HTTP DELETE',
        req: req,
        res: res,
        payload: req.query
      };
      this.send(msg);
    });

    app.delete(config.base + ':api?/:ver?/(:resource|health/nodes)/:id?', (req, res) => {
      let msg = {
        type: 'HTTP DELETE',
        req: req,
        res: res,
        payload: req.query
      };
      this.send(msg);
    });

    app.use(function(err, req, res, next) {
      this.warn(err.stack);
      res.status(500).json({
        code: 400,
        error: err.message,
        debug: err.stack
      });
      if (!next) { 3; }
    });

    let server = app.listen(config.port, () => {
      this.log(`NMOS HTTP server ${config.name} is running on port ${config.port}.`);
    });

    this.on('close', done => {
      server.close(e => {
        if (e) {
          this.warn(`NMOS HTTP server ${config.name} on port ${config.port} closed with error: ${e}`);
        } else {
          this.log(`NMOS HTTP server ${config.name} on port ${config.port} has closed.`);
        }
        done();
      });
    });
  }
  RED.nodes.registerType('nmos-http-request', NMOSHTTPRequest);
};
