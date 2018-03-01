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

module.exports = function (RED) {
  const knownResources =
    [ 'nodes', 'devices', 'sources', 'flows', 'senders', 'receivers'];
  const supportedVersions = [ 'v1.0', 'v1.1', 'v1.2'];
  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89abAB][0-9a-f]{3}-[0-9a-f]{12}$/;
  const unimplementedQueries = [ 'query.rql', 'query.ancestry_id',
    'query.ancestry_type', 'query.ancestry_generations' ];

  function QueryLogic (config) {
    RED.nodes.createNode(this, config);

    this.on('input', msg => {
      msg = Object.assign({}, msg);
      let msgType = msg.type;
      // console.log('>>>', msg.req.params);
      if (msg.type.startsWith('store') && msg.api === 'query') {
        if (msg.type === 'store read success') {
          msg.type = 'HTTP RES 200';
          msg.statusCode = 200;
          return this.send(msg);
        }
        if (msg.type === 'store read error') {
          msg.type = 'HTTP RES 404';
          msg.statusCode = 404;
          msg.payload = {
            code: 404,
            payload: msg.payload,
            debug: msg.req.url
          };
          return this.send(msg);
        }
        if (msg.type === 'store query response') {
          msg.type = 'HTTP RES 200';
          msg.statusCode = 200;
          return this.send(msg);
        }
        if (msg.type === 'store query error') {
          msg.type = `HTTP RES ${msg.statusCode}`;
          msg.payload = {
            code: msg.statusCode,
            payload: msg.payload,
            debug: msg.req.url
          };
          return this.send(msg);
        }
        return; // Here endith the store response processing
      }
      if (!msg.type.startsWith('HTTP REQ')) {
        return; // Only process HTTP messages
      }
      if (msg.api === 'unknown') {
        msg.type = msgType.startsWith('HTTP REQ GET') ?
          'HTTP RES 200' : 'HTTP RES 400';
        msg.statusCode = msgType.startsWith('HTTP REQ GET') ? 200 : 400;
        msg.payload = msgType.startsWith('HTTP REQ GET') ?
          [ 'query/' ] :
          {
            code: 400,
            error: `Received ${msgType} request with no API specified in the path.`,
            debug: msg.req.url
          }; // TODO if query is supported, add to list
        return this.send(msg);
      }
      if (msg.api !== 'query') {
        // TODO what to do if nothing responds?
        return; // Only process query messages
      }

      if (msg.version === 'unknown') { // Requesting which versions are supported
        msg.type = msgType.startsWith('HTTP REQ GET') ?
          'HTTP RES 200' : 'HTTP RES 400';
        msg.statusCode = msgType.startsWith('HTTP REQ GET') ? 200 : 400;
        msg.payload = msgType.startsWith('HTTP REQ GET') ?
          [ 'v1.0/', 'v1.1/', 'v1.2/' ] :
          {
            code: 400,
            error: `Received ${msgType} request with no version specified in the path.`,
            debug: msg.req.url
          }; // TODO if registration is supported, add to list
        return this.send(msg);
      }

      if (supportedVersions.indexOf(msg.version) < 0) {
        msg.type = 'HTTP RES 400';
        msg.statusCode = 400;
        msg.payload = {
          code: 400,
          error: `Specified version number '${msg.version}' is not supported.`,
          debug: msg.req.url
        };
        return this.send(msg);
      }

      if (!msg.req.params.resource) { // Query API base path request
        msg.type = msgType.startsWith('HTTP REQ GET') ? 'HTTP RES 200' : 'HTTP RES 400';
        msg.statusCode = msgType.startsWith('HTTP REQ GET') ? 200 : 400;
        msg.payload = msgType.startsWith('HTTP REQ GET') ?
          [
            'subscriptions/',
            'flows/',
            'sources/',
            'nodes/',
            'devices/',
            'senders/',
            'receivers/'
          ] : {
            code: 400,
            error: `Received ${msgType} request with no resource specified in the path.`,
            debug: msg.req.url
          };
        return this.send(msg);
      }

      // TODO Deal with subscriptions here
      if (knownResources.indexOf(msg.req.params.resource) < 0) {
        msg.type = 'HTTP RES 404';
        msg.statusCode = 404;
        msg.payload = {
          code: 404,
          error: `Received request for unknown resource type ${msg.req.params.resource}.`,
          debug: msg.req.url
        };
        return this.send(msg);
      }

      if (!msg.req.params.id) {
        // TODO remove this check when parameters are supported
        let notImplemented = Object.keys(msg.payload)
          .filter(k => unimplementedQueries.indexOf[k] >= 0);
        if (notImplemented.length > 0) {
          msg.type = 'HTTP RES 501';
          msg.statusCode = 501;
          msg.payload = {
            code: 501,
            error: `The query parameter ${notImplemented[0]} is not implemented.`,
            debug: msg.req.url
          };
          return this.send(msg);
        }
        msg.type = 'store query request';
        return this.send(msg);
      }

      if (!uuidPattern.test(msg.req.params.id)) {
        msg.type = 'HTTP RES 400';
        msg.statusCode = 400;
        msg.payload = {
          code: 400,
          error: `Attempt to make a ${msgType} to resource ${msg.req.params.resource} with a malforned UUID.`,
          debug: msg.req.url
        };
        return this.send(msg);
      }

      msg.type = 'store read request';
      return this.send(msg);
    });
  }
  RED.nodes.registerType('query-logic', QueryLogic);
};
