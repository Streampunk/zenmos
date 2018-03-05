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
const os = require('os');

module.exports = function (RED) {

  // Borrowed from Node-RED HTTPIn
  // https://github.com/node-red/node-red/blob/c9317659c5049f1929c4fe60bafe3c7dffa97b02/nodes/core/io/21-httpin.js#L123
  function createResponseWrapper (node,res) {
    var wrapper = {
      _res: res
    };
    var toWrap = [
      'append',
      'attachment',
      'cookie',
      'clearCookie',
      'download',
      'end',
      'format',
      'get',
      'json',
      'jsonp',
      'links',
      'location',
      'redirect',
      'render',
      'send',
      'sendfile',
      'sendFile',
      'sendStatus',
      'set',
      'status',
      'type',
      'vary'
    ];
    toWrap.forEach(f => {
      wrapper[f] = function() {
        node.warn(RED._('httpin.errors.deprecated-call',{method:'msg.res.'+f}));
        var result = res[f].apply(res,arguments);
        if (result === res) {
          return wrapper;
        } else {
          return result;
        }
      };
    });
    return wrapper;
  }

  function NMOSHTTPRequest (config) {
    RED.nodes.createNode(this, config);

    const app = express();
    app.use(bodyParser.json());
    app.use(bodyParser.raw());

    this.callback = (req, res) => {
      let msgid = RED.util.generateId();
      res._msgid = msgid;
      if (req.method.match(/^(POST|DELETE|PUT|OPTIONS|PATCH)$/)) {
        this.send({
          type: `HTTP REQ ${req.method}`,
          _msgid: msgid,
          req: req,
          res: createResponseWrapper(this, res),
          payload: req.body
        });
      } else if (req.method ==='GET') {
        this.send({
          type: 'HTTP REQ GET',
          _msgig: msgid,
          req: req,
          res: createResponseWrapper(this, res),
          payload: req.query
        });
      } else {
        this.send({
          type: `HTTP REQ ${req.method}`,
          _msgid: msgid,
          req: req,
          res: createResponseWrapper(this, res)
        });
      }
    };

    app.get(config.base + ':api?', this.callback);

    app.get(config.base + ':api/:ver', this.callback);

    app.get(config.base + ':api/:ver/resource/:resource?/:id?', (req, res) => {
      if (!req.params.resource) {
        req.params.resource = 'resource';
      }
      this.callback(req, res);
    });

    app.get(
      config.base + ':api/:ver/health/nodes/:id', this.callback);

    app.get(
      config.base + ':api/:ver/:resource/:id?', this.callback);

    app.post(config.base + ':api', this.callback);

    app.post(config.base + ':api/:ver', this.callback);

    app.post(config.base + ':api/:ver/resource', (req, res) => {
      req.params.resource = 'resource';
      this.callback(req, res);
    });

    app.post(
      config.base + ':api/:ver/health/nodes/:id', this.callback);

    app.delete(config.base + ':api', this.callback);

    app.delete(config.base + ':api/:ver', this.callback);

    app.delete(config.base + ':api/:ver/resource/:resource?/:id?', (req, res) => {
      if (!req.params.resource) {
        req.params.resource = 'resource';
      }
      this.callback(req, res);
    });

    app.use((req, res, next) => {
      let error = {
        code: 404,
        error: `Resource ${req.url} not found.`,
        debug: null
      };
      res.status(404).json(error);
      if (!next) { 3; }
      let msg = {
        type : 'HTTP RES 404',
        payload : error
      };
      this.send(msg);
    });

    app.use((err, req, res, next) => {
      this.warn(err.stack);
      let error = {
        code: 500,
        error: err.message,
        debug: err.stack
      };
      res.status(500).json(error);
      if (!next) { 3; }
      let msg = {
        type : 'HTTP RES 404',
        payload : error
      };
      this.send(msg);
    });

    let server = app.listen(config.port, () => {
      this.log(`NMOS HTTP server ${config.name} is running on port ${config.port}.`);
      let msg = {
        type: 'endpoint started',
        payload: {
          port: config.port,
          protocol: 'http',
          interface: config.interface,
          interfaces: os.networkInterfaces()
        }
      };
      this.send(msg);
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
