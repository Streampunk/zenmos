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

const os = require('os');

module.exports = function (RED) {
  var log = [];
  var seq = 0;
  const hostname = os.hostname();
  const networkIfs = (nis =>
    [].concat.apply([], Object.keys(nis).map(k => nis[k]))
      .filter(i => !i.internal)
      .map(i => i.address)
  )(os.networkInterfaces());

  const auditConnect = RED.settings.functionGlobalContext.get('audit');
  if (auditConnect)
    auditConnect(viewLog => log = viewLog);

  function AuditLog (config) {
    RED.nodes.createNode(this, config);

    this.on('input', msg => {
      msg = Object.assign({}, msg);
      log.push(msg);
      if (log.length > config.limit && log.length % 10 === 0) {
        log = log.slice(-1000);
      }
      msg.id = msg._msgid;
      msg.chain = Array.isArray(msg.chain) ? msg.chain.push(msg.id) : [ msg.id ];
      msg.timestamp = Date.now();
      msg.sequence = seq++;
      msg.profile = config.profile;
      msg.hostname = hostname;
      msg.networkInterfaces = networkIfs;
      msg.auditLogName = config.name;

      // Work out where the message came from
      if (msg.req && msg.req.method) {
        // msg.type = `HTTP ${msg.req.method}`;
        msg.version = msg.req.params.ver ? msg.req.params.ver : 'unknown';
        msg.api = msg.req.params.api ? msg.req.params.api : 'unknown';
        msg.contentType = msg.req.headers['content-type'];

        if (msg.req.method === 'POST' || msg.req.method === 'PUT') {
          if (msg.validated === undefined) {
            msg.validated = false;
          }
        }
      }

      if (config.console || config.debug) {

        let debugMsg = {
          id: msg.id,
          previous: msg.chain.length > 2 ? msg.chain.slice(-2)[0] : undefined,
          timestamp : msg.timestamp,
          sequence: msg.sequence,
          type: msg.type,
          version: msg.version,
          api: msg.api,
          payloadLength: typeof msg.payload === 'string' ? msg.payload.length : undefined,
          validated: msg.validated,
          valid: msg.valid,
          payload: typeof msg.payload === 'string' ?
            msg.payload.slice(0, 60) + (msg.payload.length > 60 ? ' ...' : '') :
            msg.payload
        };
        if (config.debug) {
          RED.comms.publish('debug', { msg: debugMsg });
        }
        if (config.console) {
          this.log(JSON.stringify(debugMsg, null, 2));
        }
      }

      this.send(msg.type.startsWith('HTTP RES') ? [ null, msg ] : [ msg, null ]);
    });

    this.on('close', () => {
      log = [];
      // Not resetting sequence
    });
  }

  AuditLog.prototype.getLog = function () {
    return log.slice(0);
  };

  RED.nodes.registerType('audit-log', AuditLog);
};
