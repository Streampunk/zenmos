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

const { dateNow } = require('../util/ptpMaths.js');

module.exports = function (RED) {
  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89abAB][0-9a-f]{3}-[0-9a-f]{12}$/;

  function Heartbeats (config) {
    RED.nodes.createNode(this, config);

    config.gcInterval = +config.gcInterval + 1;

    const heartbeatDB = new Map;
    const checkLoop = setInterval(() => {
      let tMinusGC = dateNow()[0] - config.gcInterval;
      let gcd = [];
      for ( let [k, v] of heartbeatDB ) {
        if (v < tMinusGC) {
          let msg = {
            type: 'store gc request',
            payload: k
          };
          this.send(msg);
          gcd.push(k);
          this.log(`No heartbeat received from node ${k} in more than ${config.gcInterval} seconds. Requested garbage collection.`);
        }
      }
      for ( let k of gcd ) {
        heartbeatDB.delete(k);
      }
    }, +config.checkRate * 1000);

    this.on('input', msg => {
      msg = Object.assign({}, msg);
      let msgType = msg.type;

      if (msgType === 'store create request' &&
        msg.payload.type === 'node') {

        let ts = dateNow()[0];
        heartbeatDB.set(msg.payload.data.id, ts);
        return;
      }

      if (msgType === 'store delete request' &&
        msg.req.params.resource === 'nodes') {

        heartbeatDB.delete(msg.req.params.id);
        return;
      }

      if (msgType !=='HTTP REQ GET' && msgType !== 'HTTP REQ POST') {
        return;
      }
      if (msg.api !== 'registration' || msg.version === 'unknown') {
        return;
      }
      if (msg.req.url.indexOf('health/nodes') < 0) {
        return;
      }
      if (!msg.req.params.id) {
        msg.type = 'HTTP RES 400';
        msg.statusCode = 400;
        msg.payload = {
          code: 400,
          error: `Received ${msgType} request to health service with no identifier.`,
          debug: msg.req.url
        };
        return this.send(msg);
      }

      if (!uuidPattern.test(msg.req.params.id)) {
        msg.type = 'HTTP RES 400';
        msg.statusCode = 400;
        msg.payload = {
          code: 400,
          error: `Received ${msgType} request to health service with malformed UUID.`,
          debug: msg.req.url
        };
        return this.send(msg);
      }

      if (msgType === 'HTTP REQ POST') {
        if (heartbeatDB.has(msg.req.params.id)) {
          let ts = dateNow()[0];
          heartbeatDB.set(msg.req.params.id, ts);
          msg.type = 'HTTP RES 200';
          msg.statusCode = 200;
          msg.payload = {
            health: ts.toString()
          };
        } else {
          msg.type = 'HTTP RES 404';
          msg.statusCode = 404;
          msg.payload = {
            code: 404,
            error: `On heartbeat, node with ID ${msg.req.params.id} is not know in this registry.`,
            debug: msg.req.url
          };
        }
        return this.send(msg);
      }

      if (msgType === 'HTTP REQ GET') {
        if (heartbeatDB.has(msg.req.params.id)) {
          msg.type = 'HTTP RES 200';
          msg.statusCode = 200;
          msg.payload = {
            health: heartbeatDB.get(msg.req.params.id).toString()
          };
        } else {
          msg.type = 'HTTP RES 404';
          msg.statusCode = 404;
          msg.payload = {
            code: 404,
            error: `This registration service is not maintaining a heartbeat record for node ${msg.req.params.id}.`,
            debug: msg.req.url
          };
        }
        return this.send(msg);
      }
    });

    this.on('close', () => {
      clearInterval(checkLoop);
    });
  }
  RED.nodes.registerType('heartbeats', Heartbeats);
};
