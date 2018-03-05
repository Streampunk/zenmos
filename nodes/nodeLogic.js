/* Copyright 2018 Streampunk Media Ltd.

  Licensed under the Apache License, Version 2.0 (the 'License');
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an 'AS IS' BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

const uuidv4 = require('uuid/v4');
const { selfMaker, deviceMaker, sourceMaker, flowMaker,
  senderMaker, receiverMaker } = require('../util/resourceGenerator.js');
const { versionTS, compareVersions } = require('../util/ptpMaths.js');

module.exports = function (RED) {
  const knownResources =
    [ 'self', 'devices', 'sources', 'flows', 'senders', 'receivers'];
  const supportedVersions = [ 'v1.0', 'v1.1', 'v1.2' ];
  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89abAB][0-9a-f]{3}-[0-9a-f]{12}$/;
  const flattenIFs = i => Object.entries(i).reduce((x, [k, v]) =>
    x.concat(v.map(z =>
      Object.assign(z, {name : k}))), []);

  function NodeLogic (config) {
    RED.nodes.createNode(this, config);
    this.store = new Map; // current internal state of the node
    this.since = '0:0';
    this.nmosVersion = config.nmosVersion;

    if (!config.selfID) {
      config.selfID = uuidv4();
    }
    switch (config.nmosVersion) {
    case 'v10':
      config.versions = supportedVersions.slice(0, 1);
      break;
    case 'v11':
      config.versions = supportedVersions.slice(0, 2);
      break;
    default:
      config.versions = supportedVersions;
      break;
    }
    config.entries = () => this.store.entries();
    let selfKey = `self_${config.selfID}`;
    (s => this.store.set(selfKey, s))(selfMaker(config));
    for ( let x = 0 ; x < +config.devices ; x++ ) {
      (s => this.store.set(`devices_${s.id}`, s))(deviceMaker(config));
    }
    for ( let x = 0 ; x < +config.sources ; x++ ) {
      (s => this.store.set(`sources_${s.id}`, s))(sourceMaker(config));
    }
    for ( let x = 0 ; x < +config.flows ; x++ ) {
      (s => this.store.set(`flows_${s.id}`, s))(flowMaker(config));
    }
    for ( let x = 0 ; x < +config.senders ; x++ ) {
      (s => this.store.set(`senders_${s.id}`, s))(senderMaker(config));
    }
    for ( let x = 0 ; x < +config.receivers ; x++ ) {
      (s => this.store.set(`receivers_${s.id}`, s))(receiverMaker(config));
    }
    this.sendUpdates(false);

    this.on('input', msg => {
      msg = Object.assign({}, msg);
      let msgType = msg.type;

      if (msg.type === 'endpoint started') {
        let self = this.store.get(selfKey);
        let flatIFs = flattenIFs(msg.payload.interfaces)
          .filter(i => !i.internal)
          .filter(i => msg.payload.interface === '0.0.0.0' ||
            msg.payload.interface === i.address );
        let macs = flattenIFs(msg.payload.interfaces)
          .filter(i => !i.internal)
          .reduce((x, y) => { x[y.name] = y.mac; return x; }, {});
        let myNewSelf = Object.assign(self, {
          version: versionTS(),
          href: `${msg.payload.protocol}://${flatIFs[0].address}:${msg.payload.port}/`,
          api: config.nmosVersion === 'v10' ? undefined : {
            versions: config.versions,
            endpoints: self.api.endpoints.concat(flatIFs.map(i => ({
              host: i.address,
              port: msg.payload.port,
              protocol: msg.payload.protocol
            })))
          },
          interfaces: config.nmosVersion === 'v10' ? undefined :
            self.interfaces.concat(Object.entries(macs).map(([k, v]) => ({
              name: k,
              chassis_id: v.replace(/:/g, '-'),
              port_id: v.replace(/:/g, '-')
            })))
        });
        this.store.set(selfKey, myNewSelf);
        return;
      }

      if (!msg.type.startsWith('HTTP REQ')) {
        return; // Only process HTTP messages
      }

      if (msg.api === 'unknown') {
        msg.type = msgType.startsWith('HTTP REQ GET') ?
          'HTTP RES 200' : 'HTTP RES 400';
        msg.statusCode = msgType.startsWith('HTTP REQ GET') ? 200 : 400;
        msg.payload = msgType.startsWith('HTTP REQ GET') ?
          [ 'node/' ] :
          {
            code: 400,
            error: `Received ${msgType} request with no API specified in the path.`,
            debug: msg.req.url
          }; // TODO if query is supported, add to list
        return this.send(msg);
      }
      if (msg.api !== 'node') {
        // TODO what to do if nothing responds?
        return; // Only process query messages
      }

      if (msg.version === 'unknown') {
        msg.type = msgType.startsWith('HTTP REQ GET') ?
          'HTTP RES 200' : 'HTTP RES 400';
        msg.statusCode = msgType.startsWith('HTTP REQ GET') ? 200 : 400;
        msg.payload = msgType.startsWith('HTTP REQ GET') ?
          config.versions :
          {
            code: 400,
            error: `Received ${msgType} request with no API specified in the path.`,
            debug: msg.req.url
          };
        return this.send(msg);
      }

      if (config.versions.indexOf(msg.version) < 0) {
        msg.type = 'HTTP RES 400';
        msg.statusCode = 400;
        msg.payload = {
          code: 400,
          error: `Specified version number '${msg.version}' is not supported.`,
          debug: msg.req.url
        };
        return this.send(msg);
      }

      if (!msg.req.params.resource) { // Node API base path request
        msg.type = msgType.startsWith('HTTP REQ GET') ? 'HTTP RES 200' : 'HTTP RES 400';
        msg.statusCode = msgType.startsWith('HTTP REQ GET') ? 200 : 400;
        msg.payload = msgType.startsWith('HTTP REQ GET') ? [
          'self/',
          'sources/',
          'flows/',
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
        if (typeof msg.payload === 'object' &&
          Object.keys(msg.payload).length > 0) {
          msg.type = 'HTTP RES 501';
          msg.statusCode = 501;
          msg.payload = {
            code: 501,
            error: 'Query parameters are not implemented by the Node API.',
            debug: msg.req.url
          };
          return this.send(msg);
        }
        msg.type = 'HTTP RES 200';
        msg.statusCode = 200;
        if (msg.req.params.resource === 'self') {
          msg.payload = this.store.get(selfKey);
          return this.send(msg);
        }
        msg.payload = [];
        for ( let [k, v] of this.store ) {
          if (k.startsWith(msg.req.params.resource)) {
            msg.payload.push(v);
          }
        }
        return this.send(msg);
      }

      if (msg.req.params.resource === 'self') {
        msg.type = 'HTTP RES 400';
        msg.statusCode = 400;
        msg.payload = {
          code: 400,
          error: 'Received a request for a sub-resource of self, which is not supported by the Node API.',
          debug: msg.req.url
        };
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

      let storeKey = `${msg.req.params.resource}_${msg.req.params.id}`;
      let resource = this.store.get(storeKey);
      if (resource) {
        msg.type = 'HTTP RES 200';
        msg.statusCode = 200;
        msg.payload = resource;
        return this.send(msg);
      }

      // TODO deal with deprecated target resource

      msg.type = 'HTTP RES 404';
      msg.statusCode = 404;
      msg.payload = {
        code: 404,
        error: `Resource of type ${msg.req.params.resource} with identifier '${msg.req.params.id}' is not found.`,
        debug: msg.req.url
      };
      return this.send(msg);
    });

    this.on('close', () => {
      this.store.clear();
    });
  }
  RED.nodes.registerType('node-logic', NodeLogic);

  NodeLogic.prototype.createResource = function (type, resource) {
    let resKey = `${type}_${resource.id}`;
    if (this.store.has(resKey)) {
      throw new Error(`On resource creation, Node API collection of ${type} already has resource with id '${resource.id}'.`);
    }
    this.store.set(resKey, resource);
    this.sendUpdates(false);
  };
  NodeLogic.prototype.updateResource = function (type, resource) {
    let resKey = `${type}_${resource.id}`;
    if (!this.store.has(resKey)) {
      throw new Error(`On resource update, Node API collection of ${type} does not have a resource with id '${resource.id}'.`);
    }
    this.store.set(resKey, resource);
    this.sendUpdates(true);
  };
  NodeLogic.prototype.deleteResource = function (type, id) {
    let resKey = `${type}_${id}`;
    if (!this.store.has(resKey)) {
      throw new Error(`On resource delete, Node API collection of ${type} does not have a resource with id '${id}'.`);
    }
    return this.store.delete(resKey);
  };
  NodeLogic.prototype.readResource = function (type, id) {
    let resKey = `${type}_${id}`;
    if (!this.store.has(resKey)) {
      throw new Error(`On resource read, Node API colleciton of ${type} does not have a resource with id '${id}'.`);
    }
    return this.store.get(resKey);
  };
  NodeLogic.prototype.countResource = function (type) {
    let count = 0;
    for ( let [k, ] of this.store ) {
      if (k.startsWith(type)) count++;
    }
    return count;
  };
  NodeLogic.prototype.sendUpdates = function (update = false) {
    let max = this.since;
    for ( let [k, v] of this.store ) {
      if (v.version && compareVersions(v.version, this.since) >= 0) {
        let msg = {
          type: 'HTTP REQ POST',
          url: `:registration/x-nmos/registration/${this.nmosVersion}/resource`,
          method: 'POST',
          payload: {
            type: k.split('_')[0].replace(/self/, 'node'),
            data: v
          },
          update: update
        };
        this.send(msg);
        max = compareVersions(max, v.version) >= 0 ? max : v.version;
      }
    }
    this.since = max;
  };
};
