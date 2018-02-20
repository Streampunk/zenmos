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

  function StateStoreRAM (config) {
    RED.nodes.createNode(this, config);

    this.on('input', msg => {
      if (msg.type === 'store create request') {
        let resourceType = msg.req.param.resource;
        let id = msg.payload.id;
        let resVer = msg.payload.version;
        let apiVer = msg.payload.params.ver;
        let [ storeKey, latestKey ] = makeKeys(resourceType, id, resVer);
        if (store.has(storeKey)) {
          msg.type = 'store create error';
          msg.payload = `Collection ${resourceType} already has an item with ID ${id} and version ${resVer}.`;
          return this.send(msg);
        }
        store.set(storeKey, msg.payload);
        latest.set(latestKey, storeKey);
        apiVersion.set(storeKey, apiVer);
        msg.storeKey = storeKey;
        msg.store = this; // Send the store so intgrity checks can be made
        msg.type = 'store create response';
        return this.send(msg);
      }
      if (msg.type === 'store read request') {
        let resourceType = msg.req.param.resource;
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
        if (storeKey === 'tombstone') {
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
        let resourceType = msg.req.param.resource;
        let id = msg.reg.params.id;
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
        if (storeKey === 'tombstone') {
          msg.type = 'store delete error';
          msg.payload = `Read request for a resource from the ${resourceType} this is marked as deleted.`;
          return this.send(msg);
        }
        latest.set(`${resourceType}_${id}`, 'tombstone');
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
