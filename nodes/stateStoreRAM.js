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
  const store = new Map; // Store of all NMOS resource
  const latest = new Map; // Store of pointers to the latest version
  const apiVersion = new Map; // Map of API version claimed for the item
  const makeKeys = (resourceType, id, version) =>
    [ `${resourceType}_${id}_${version}`, `${resourceType}_${id}` ];

  function extractVersions(v) {
    var m = v.match(/^([0-9]+):([0-9]+)$/);
    if (m === null) { return [Number.MAX_SAFE_INTEGER, 0]; }
    return [+m[1], +m[2]];
  }

  function compareVersions(l, r) {
    var lm = extractVersions(l);
    var rm = extractVersions(r);
    if (lm[0] < rm[0]) return -1;
    if (lm[0] > rm[0]) return 1;
    if (lm[1] < rm[1]) return -1;
    if (lm[1] > rm[1]) return 1;
    return 0;
  }

  function StateStoreRAM (config) {
    RED.nodes.createNode(this, config);

    this.on('input', msg => {
      if (msg.type === 'store create request') {
        if (!msg.payload.type) {
          msg.type = 'store create error';
          msg.payload = `On resource creation for type ${resourceType}, type field is ${msg.payload.type}.`;
          return this.send(msg);
        }
        let resourceType = msg.payload.type + 's';
        if (!msg.payload.data) {
          msg.type = 'store create error';
          msg.payload = `On resource creation for type ${resourceType}, data field is missing.`;
          return this.send(msg);
        }
        let id = msg.payload.data.id;
        let resVer = msg.payload.data.version;
        if (!id || !resVer) {
          msg.type = 'store create error';
          msg.payload = `On resource creation for type ${resourceType}, ${!id ? 'id' : 'version'} is missing.`;
          return this.send(msg);
        }
        let apiVer = msg.version;
        let [ storeKey, latestKey ] = makeKeys(resourceType, id, resVer);
        if (config.ascending && latest.has(latestKey)) {
          let oldKey = latest.get(latestKey);
          let oldResVer = oldKey.slice(oldKey.lastIndexOf('_') + 1);
          if (compareVersions(oldResVer, resVer) === 1) {
            msg.type = 'store create error';
            msg.payload = `On resource creation for type ${resourceType}, new version ${resVer} is older than existing version ${oldResVer}.`;
            return this.send(msg);
          }
        }
        if (store.has(storeKey)) {
          msg.type = 'store create error';
          msg.payload = latest.get(latestKey).startsWith('tombstone') ?
            `Collection ${resourceType} previously had an item with ID ${id} and version ${resVer}, now marked as deleted.` :
            `Collection ${resourceType} already has an item with ID ${id} and version ${resVer}.`;
          return this.send(msg);
        }
        store.set(storeKey, msg.payload);
        msg.update = latest.has(latestKey);
        latest.set(latestKey, storeKey);
        apiVersion.set(storeKey, apiVer);
        msg.storeKey = storeKey;
        msg.store = this; // Send the store so intgrity checks can be made
        msg.req.params.resource = resourceType;
        msg.payload = msg.payload.data;
        msg.type = 'store create success';
        return this.send(msg);
      }
      if (msg.type === 'store read request') {
        let resourceType = msg.req.params.resource;
        let id = msg.req.params.id;
        if (!id) {
          msg.type = 'store read error';
          msg.payload = `Read request for elements from ${resourceType} store without an identier.`;
          return this.send(msg);
        }
        let storeKey = latest.get(`${resourceType}_${id}`);
        if (!storeKey) {
          msg.type = 'store read error';
          msg.payload = `Read request for a resource from the ${resourceType} that does not exist.`;
          return this.send(msg);
        }
        if (storeKey.startsWith('tombstone')) {
          msg.type = 'store read error';
          msg.payload = `Read request for a resource from the ${resourceType} this is marked as deleted.`;
          return this.send(msg);
        }
        let result = store.get(storeKey);
        if (!result) {
          msg.type = 'store read error';
          msg.payload = `Internal error: Request for a resource from ths ${resourceType} that is not stored.`;
          return this.send(msg);
        }
        msg.type = 'store read success';
        msg.payload = result;
        msg.storeKey = storeKey;
        msg.apiVersion = apiVersion.get(storeKey);
        return this.send(msg);
      }
      if (msg.type === 'store delete request') {
        let resourceType = msg.req.params.resource;
        let id = msg.req.params.id;
        if (!id) {
          msg.type = 'store delete error';
          msg.payload = `Delete request for elements from ${resourceType} store without an identier.`;
          return this.send(msg);
        }
        let storeKey = latest.get(`${resourceType}_${id}`);
        if (!storeKey) {
          msg.type = 'store delete error';
          msg.payload = `Request for a resource from the ${resourceType} that does not exist.`;
          return this.send(msg);
        }
        let oldResVer = storeKey.slice(storeKey.lastIndexOf('_') + 1);
        if (storeKey.startsWith('tombstone')) {
          msg.type = 'store delete error';
          msg.payload = `Read request for a resource from the ${resourceType} this is marked as deleted.`;
          return this.send(msg);
        }
        latest.set(`${resourceType}_${id}`, `tombstone_${oldResVer}`);
        msg.type = 'store delete success';
        return this.send(msg);
      }
      // if (msg.type === 'store query request') {
      // Check query parameters in payload and search the store wrt the logic.
      //}
      // TODO - send on other messages?
    });

    this.on('close', () => {
      store.clear();
      latest.clear();
      apiVersion.clear();
    });
  }
  RED.nodes.registerType('state-store-RAM', StateStoreRAM);
};
