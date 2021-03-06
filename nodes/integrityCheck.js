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
  function IntegrityCheck (config) {
    RED.nodes.createNode(this, config);

    let revRef = new Map; // Reverse lookup - on delete, what might reference me?

    const addRef = (src, srcType, dest) => {
      if (!revRef.has(dest)) {
        revRef.set(dest, new Set);
      }
      revRef.get(dest).add({ src: src, type: srcType });
    };

    let checkRef = (msg, srcType, destType, prop, deleting = false) => {
      if (msg.req.params.resource.startsWith(srcType)) {
        let resource = msg.payload;
        if (Array.isArray(resource[prop])) {
          let missing = resource[prop].filter(ref =>
            !msg.store.exists(destType, ref));
          resource[prop]
            .filter(ref => missing.indexOf(ref) < 0)
            .forEach(ref => addRef(resource.id, msg.req.params.resource, ref));
          if (missing.length > 0) {
            if (config.debug) {
              RED.comms.publish('debug', { msg: {
                type: 'integrity check failure',
                property: `${srcType}.${prop}`,
                source_id: resource.id,
                dest_id: resource[prop],
                deleting: deleting
              } });
              this.send({
                type: 'integrity check failure',
                payload: {
                  code: 404,
                  error: (deleting ? 'Deleted destination means property ' : 'Property ') +
                    `'${srcType}.${prop}' references one or more ${destType}(s) not known in the registry.`,
                  debug: {
                    property: `${srcType}.${prop}`,
                    source_id: resource.id,
                    dest_id: missing,
                    deleting: deleting
                  }
                }
              });
            }
          } else {
            if (config.debug) {
              RED.comms.publish('debug', { msg: {
                type: 'integrity check success',
                property: `${srcType}.${prop}`,
                source_id: resource.id,
                dest_id: resource[prop],
                deleting: deleting
              } });
            }
          }
        } else {
          addRef(resource.id, msg.req.params.resource, resource[prop]);
          if (!msg.store.exists(destType, resource[prop])) {
            if (config.debug) {
              RED.comms.publish('debug', { msg: {
                type: 'integrity check failure',
                property: `${srcType}.${prop}`,
                source_id: resource.id,
                dest_id: resource[prop],
                deleting: deleting
              } });
              this.send({
                type: 'integrity check failure',
                payload: {
                  code: 404,
                  error: (deleting ? 'Deleted destination means property ' : 'Property ') +
                    `'${srcType}.${prop}' references a ${destType} not known in the registry.`,
                  debug: {
                    property: `${srcType}.${prop}`,
                    source_id: resource.id,
                    dest_id: resource[prop],
                    deleting: deleting
                  }
                }
              });
            }
          } else {
            if (config.debug) {
              RED.comms.publish('debug', { msg: {
                type: 'integrity check success',
                property: `${srcType}.${prop}`,
                source_id: resource.id,
                dest_id: resource[prop],
                deleting: deleting
              } });
            }
          }
        }
      }
    };

    this.on('input', msg => {
      if (!msg.type.startsWith('store') || !msg.type.endsWith('success')) {
        return; // Only check store messages that are successful
      }
      if (msg.type.indexOf('create') >= 0) {
        // device => node_id (senders array & receivers array deprecated - phew!)
        checkRef(msg, 'device', 'node', 'node_id');
        // source => device_id, parents array
        checkRef(msg, 'source', 'device', 'device_id');
        checkRef(msg, 'source', 'source', 'parents');
        // receiver => device_id, subscription/sender_id
        checkRef(msg, 'receiver', 'device', 'device_id');
        // TODO subscriptions
        // sender => device_id, flow_id, subscription/receiver_id (unicast only)
        checkRef(msg, 'sender', 'device', 'device_id');
        checkRef(msg, 'sender', 'flow', 'flow_id');
        // TODO subscription
        // flow => source_id, device_id, parents
        checkRef(msg, 'flow', 'source', 'source_id');
        checkRef(msg, 'flow', 'device', 'device_id');
        checkRef(msg, 'flow', 'flow', 'parents');
      }
      if (config.deleted === true && msg.type.indexOf('delete') >= 0) {
        if (revRef.has(msg.req.params.id)) {
          for ( let src of revRef.get(msg.req.params.id)) {
            let testMsg = Object.assign({}, msg);
            testMsg.payload = src.src;
            testMsg.req.params.resource = src.type;
            // device => node_id (senders array & receivers array deprecated - phew!)
            checkRef(testMsg, 'device', 'node', 'node_id', true);
            // source => device_id, parents array
            checkRef(testMsg, 'source', 'device', 'device_id', true);
            checkRef(testMsg, 'source', 'source', 'parents', true);
            // receiver => device_id, subscription/sender_id
            checkRef(testMsg, 'receiver', 'device', 'device_id', true);
            // TODO subscriptions
            // sender => device_id, flow_id, subscription/receiver_id (unicast only)
            checkRef(msg, 'sender', 'device', 'device_id', true);
            checkRef(msg, 'sender', 'flow', 'flow_id', true);
            // TODO subscription
            // flow => source_id, device_id, parents
            checkRef(msg, 'flow', 'source', 'source_id', true);
            checkRef(msg, 'flow', 'device', 'device_id', true);
            checkRef(msg, 'flow', 'flow', 'parents', true);
          }
        }
      }
      return; // Another kind of store message
    });
  }
  RED.nodes.registerType('integrity-check', IntegrityCheck);
};
