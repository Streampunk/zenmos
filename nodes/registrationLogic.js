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
      let msgType = msg.type;
      console.log('>>>', msg.req.app._router);
      console.log('>>>', msg.req.params);
      if (!msg.type.startsWith('HTTP')) {
        return; // Only process HTTP messages
      }
      if (msg.api === 'unknown') {
        msg.type = msgType.startsWith('HTTP GET') ? 'HTTP 200' : 'HTTP 400';
        msg.statusCode = msgType.startsWith('HTTP GET') ? 200 : 400;
        msg.payload = msgType.startsWith('HTTP GET') ?
          [ 'registration/' ] :
          {
            code: 400,
            error: `Received ${msgType} request with no API specified in the path.`,
            debug: msg.req.url
          }; // TODO if query is supported, add to list
        return this.send(msg);
      }
      if (msg.version === 'unknown') { // Requesting which versions are supported
        msg.type = msgType.startsWith('HTTP GET') ? 'HTTP 200' : 'HTTP 400';
        msg.statusCode = msgType.startsWith('HTTP GET') ? 200 : 400;
        msg.payload = msgType.startsWith('HTTP GET') ?
          [ 'registration/' ] :
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
        msg.type = msgType.startsWith('HTTP GET') ? 'HTTP 200' : 'HTTP 400';
        msg.statusCode = msgType.startsWith('HTTP GET') ? 200 : 400;
        msg.payload = msgType.startsWith('HTTP GET') ?
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
        if (msg.type !== 'HTTP POST') {
          msg.type = 'HTTP 400';
          msg.statusCode = 400;
          msg.payload = {
            code: 400,
            error: 'Received non-POST request at Registration API \'resource\' path.',
            debug: msg.req.url
          };
          return this.send(msg);
        }
      }

      if (knownResources.indexOf(msg.req.params.resource) < 0) {
        msg.type = 'HTTP 400';
        msg.statusCode = 400;
        msg.payload = {
          code: 400,
          error: `Attempt to make a ${msgType} request to an unsupported resource type.`,
          debug: msg.req.url
        };
        return this.send(msg);
      }

      if (typeof msg.req.params.id === 'undefined') {
        msg.type = 'HTTP 400';
        msg.statusCode = 400;
        msg.payload = {
          code: 400,
          error: `Attempt to make a ${msgType} without a resource identifier.`,
          debug: msg.req.url
        };
        return this.send(msg);
      }

      console.log('>>>', msg.req.params.id, msg.req.params.id.match(uuidPattern));
      if (msg.req.params.id.match(uuidPattern) === null) {
        msg.type = 'HTTP 400';
        msg.statusCode = 400;
        msg.payload = {
          code: 400,
          error: `Attempt to make a ${msgType} to resource ${msg.req.params.resource} with a malforned UUID.`,
          debug: msg.req.url
        };

        msg.type = 'HTTP 404';
        msg.statusCode = 404;
        msg.payload = {
          code: 404,
          error: `The resrouce for a request of type ${msgType} was not found.`,
          debug: msg.req.url
        };
        return this.send(msg);
      } // HTTP request
    });

    this.on('close', this.close);
  }
  RED.nodes.registerType('registration-logic', RegistrationLogic);
};