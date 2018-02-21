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
  const uuidPattern =
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;

  function RegistrationLogic (config) {
    RED.nodes.createNode(this, config);

    this.on('input', msg => {
      msg = Object.assign({}, msg);
      let msgType = msg.type;
      // console.log('>>>', msg.req.params);
      if (msg.type.startsWith('store')) {
        if (msg.type === 'store create error') {
          msg.type = 'HTTP RES 400';
          msg.statusCode = 400;
          msg.payload = {
            code: 400,
            error: `Store creation error: ${msg.payload}`,
            debug: null
          };
          return this.send(msg);
        }
        if (msg.type === 'store create success') {
          msg.statusCode = msg.update ? 200 : 201;
          msg.type = `HTTP RES ${msg.statusCode}`;
          msg.headers = {
            'Location': `/x-nmos/${msg.api}/${msg.version}/resource/${msg.req.params.resource}/${msg.payload.id}`
          };
          return this.send(msg);
        }
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
        if (msg.type === 'store delete success') {
          msg.type = 'HTTP RES 204';
          msg.statusCode = 204;
          msg.payload = null;
          return this.send(msg);
        }
        if (msg.type === 'store delete error') {
          msg.type = 'HTTP RES 404';
          msg.statusCode = 404;
          msg.payload = {
            code: 404,
            error: msg.payload,
            debug: msg.req.url
          };
          return this.send(msg);
        }
        return; // Here endith the processing of the store messages.
      }

      if (!msg.type.startsWith('HTTP REQ')) {
        return; // Only process HTTP messages
      }
      if (msg.api === 'unknown') {
        msg.type = msgType.startsWith('HTTP REQ GET') ?
          'HTTP RES 200' : 'HTTP RES 400';
        msg.statusCode = msgType.startsWith('HTTP REQ GET') ? 200 : 400;
        msg.payload = msgType.startsWith('HTTP REQ GET') ?
          [ 'registration/' ] :
          {
            code: 400,
            error: `Received ${msgType} request with no API specified in the path.`,
            debug: msg.req.url
          }; // TODO if query is supported, add to list
        return this.send(msg);
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
          }; // TODO if query is supported, add to list
        return this.send(msg);
      }
      if (msg.api !== 'registration') {
        // TODO what to do if nothing responds?
        return; // Only process registration messages
      }

      if (!msg.req.params.resource) { // Registration API base path request
        msg.type = msgType.startsWith('HTTP REQ GET') ? 'HTTP RES 200' : 'HTTP RES 400';
        msg.statusCode = msgType.startsWith('HTTP REQ GET') ? 200 : 400;
        msg.payload = msgType.startsWith('HTTP REQ GET') ?
          [ 'resource/', 'health/' ] :
          {
            code: 400,
            error: `Received ${msgType} request with no resource specified in the path.`,
            debug: msg.req.url
          };
        return this.send(msg);
      }

      if (msg.req.url.indexOf('health/nodes') >= 0) {
        return; // Let the heartbeat processing logic deal with the message
      }

      if (msg.req.params.resource === 'resource') {
        if (msg.type !== 'HTTP REQ POST') {
          msg.type = 'HTTP RES 400';
          msg.statusCode = 400;
          msg.payload = {
            code: 400,
            error: `Received non-POST ${msgType} request at Registration API 'resource' path.`,
            debug: msg.req.url
          };
          return this.send(msg);
        }

        if (!msg.contentType.startsWith('application/json')) {
          msg.type = 'HTTP RES 400';
          msg.statusCode = 400;
          msg.payload = {
            code: 400,
            error: `Did not receive JSON content type for POST to create ${msg.req.params.resource}.`,
            debug: msg.contentType ? `Content-Type: ${msg.contentType}` : 'unknown'
          };
          return this.send(msg);
        }
        msg.type = 'store create request';
        return this.send(msg);
      }

      if (knownResources.indexOf(msg.req.params.resource) < 0) {
        msg.type = 'HTTP RES 400';
        msg.statusCode = 400;
        msg.payload = {
          code: 400,
          error: `Attempt to make a ${msgType} request to an unsupported resource type.`,
          debug: msg.req.url
        };
        return this.send(msg);
      }

      if (typeof msg.req.params.id === 'undefined') {
        msg.type = 'HTTP RES 400';
        msg.statusCode = 400;
        msg.payload = {
          code: 400,
          error: `Attempt to make a ${msgType} request without a resource identifier.`,
          debug: msg.req.url
        };
        return this.send(msg);
      }

      if (msg.req.params.id.match(uuidPattern) === null) {
        msg.type = 'HTTP RES 400';
        msg.statusCode = 400;
        msg.payload = {
          code: 400,
          error: `Attempt to make a ${msgType} to resource ${msg.req.params.resource} with a malforned UUID.`,
          debug: msg.req.url
        };
        return this.send(msg);
      }

      msg.type = (msgType === 'HTTP REQ GET') ?
        'store read request' : 'store delete request';
      return this.send(msg);
    });
  }
  RED.nodes.registerType('registration-logic', RegistrationLogic);
};
