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

const PAGING_LIMIT = 10;

module.exports = function (RED) {
  const store = new Map; // Store of all NMOS resource
  const latest = new Map; // Store of pointers to the latest version
  const makeKeys = (resourceType, id, version) =>
    [ `${resourceType}_${id}_${version}`, `${resourceType}_${id}` ];
  const stampPattern = /^([0-9]+):([0-9]+)$/;
  const versionPattern = /^v[0-9]+.[0-9]+$/;
  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  const queryParamTests = [
    { name : 'paging.since', test : v => stampPattern.test(v) },
    { name : 'paging.until', test : v => stampPattern.test(v) },
    { name : 'paging.limit', transform : v => +v,
      test : v => !isNaN(v) && v > 0 },
    { name : 'paging.order', test : v => v === 'create' || v === 'update' },
    { name : 'query.downgrade', test : v => versionPattern.test(v) },
    { name : 'query.rql', test : v => v.length > 0 },
    { name : 'query.ancestry_id', test : v => uuidPattern.test(v) },
    { name : 'query.ancestry_type', test : v => v === 'parents' || v === 'children' },
    { name : 'query.ancestry_generations', transform : v => + v,
      test : v => !isNaN(v) && v >= 0 }
  ];
  const nineZeros = '000000000';
  // const maxPTP = `${Number.MAX_SAFE_INTEGER}:000000000`;
  const formatTS = ts => {
    ts = extractVersions(ts);
    let ts1 = ts[1].toString();
    return `${ts[0]}:${nineZeros.slice(0, -ts1.length)}${ts1}`;
  };
  const deref = (o, a) => a.reduce((x, y) => typeof x === 'object' ? x[y] : x, o);
  const joinKey = a => a.reduce((x, y) => `${x}.${y}`);

  function extractVersions(v) {
    if (Array.isArray(v)) return v;
    var m = stampPattern.exec(v);
    if (m === null) { return typeof v === 'number' ?
      [v / 1000 | 0, (v % 1000) * 1000000 | 0] : [Number.MAX_SAFE_INTEGER, 0]; }
    return [+m[1], +m[2]];
  }

  const ptpMinusOne = ts => {
    let [ ts1, ts2 ] = extractVersions(ts);
    ts2 = ts2 - 1;
    if (ts2 === -1) { ts1 = ts1 - 1; ts2 = 0; }
    return [ ts1, ts2 ];
  };

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
      msg = Object.assign({}, msg);
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
          let oldKey = latest.get(latestKey).key;
          let oldResVer = oldKey.slice(oldKey.lastIndexOf('_') + 1);
          if (compareVersions(oldResVer, resVer) === 1) {
            msg.type = 'store create error';
            msg.payload = `On resource creation for type ${resourceType}, new version ${resVer} is older than existing version ${oldResVer}.`;
            return this.send(msg);
          }
        }
        if (store.has(storeKey)) {
          msg.type = 'store create error';
          msg.payload = latest.get(latestKey).key.startsWith('tombstone') ?
            `Collection ${resourceType} previously had an item with ID ${id} and version ${resVer}, now marked as deleted.` :
            `Collection ${resourceType} already has an item with ID ${id} and version ${resVer}.`;
          return this.send(msg);
        }
        store.set(storeKey, msg.payload.data);
        msg.update = latest.has(latestKey);
        let timeNow = Date.now();
        latest.set(latestKey, {
          key: storeKey,
          apiVersion: apiVer,
          updateTime: timeNow,
          createdTime: msg.update ? latest.get(latestKey).createdTime : timeNow
        });
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
        let latestKey = `${resourceType}_${id}`;
        if (!latest.has(latestKey)) {
          msg.type = 'store read error';
          msg.payload = `Read request for a resource from the ${resourceType} with id '${id}' that does not exist.`;
          return this.send(msg);
        }
        let { key: storeKey, apiVersion: apiVer } = latest.get(latestKey);
        if (!storeKey) {
          msg.type = 'store read error';
          msg.payload = `Read request for a resource from the ${resourceType} with id '${id}' that is not stored.`;
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
        msg.apiVersion = apiVer;
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
        let latestKey = `${resourceType}_${id}`;
        if (!latest.has(latestKey)) {
          msg.type = 'store delete error';
          msg.payload = `Request for a resource from the ${resourceType} that does not exist.`;
          return this.send(msg);
        }
        let { key: storeKey, createdTime: createdTime } = latest.get(latestKey);

        let oldResVer = storeKey.slice(storeKey.lastIndexOf('_') + 1);
        if (storeKey.startsWith('tombstone')) {
          msg.type = 'store delete error';
          msg.payload = `Read request for a resource from the ${resourceType} this is marked as deleted.`;
          return this.send(msg);
        }
        latest.set(latestKey, {
          key: `tombstone_${oldResVer}`,
          apiVersion: msg.version,
          updatedTime: Date.now(),
          createdTime: createdTime
        });
        msg.type = 'store delete success';
        return this.send(msg);
      }

      let testQueryParam = (name, test) => {
        let value = msg.payload[name];
        if (value === undefined) return true;
        if (test(value)) {
          return true;
        } else {
          msg.type = 'store query error';
          msg.statusCode = 400;
          msg.payload = `On a query of the ${msg.req.params.resource}, query parameter '${name}' with value '${value}' is not valid.`;
          return false;
        }
      };

      if (msg.type === 'store query request') {
        let resourceType = msg.req.params.resource;
        let results = [];
        for ( let t of queryParamTests) {
          if (t.transform && msg.payload[t.name]) {
            msg.payload[t.name] = t.transform(msg.payload[t.name]);
          }
        }
        if (!queryParamTests.every(t => testQueryParam(t.name, t.test))) {
          return this.send(msg);
        }
        let limit = msg.payload['paging.limit'] ?
          msg.payload['paging.limit'] : PAGING_LIMIT;
        let timeKey = msg.payload['paging.order'] === 'create' ?
          'createdTime' : 'updateTime';
        let since = msg.payload['paging.since'] ?
          extractVersions(msg.payload['paging.since']) : [0, 0];
        let until = msg.payload['paging.until'] ?
          extractVersions(msg.payload['paging.until']) :
          [Number.MAX_SAFE_INTEGER, 0];
        // Filter out nodes of a given type
        for ( let [k, v] of latest ) {
          if (k.startsWith(resourceType)) {
            if (!v.key.startsWith('tombstone')) {
              results.push(v);
            }
          }
        }

        // Reverse sort ... it's in a documentation note
        results = results.sort((l, r) => compareVersions(r[timeKey], l[timeKey]));
        results = results.map(r => store.get(r.key));
        let [ first, last ] = results.length > 0 ?
          [ results.slice(-1)[0].version, results[0].version ] :
          [ undefined, undefined ];
        results = results.filter(r => // paging since and unitl filters
          compareVersions(since, r.version) < 0 &&
          compareVersions(r.version, until) <= 0);
        results = results.filter(r => { // basic query filters
          Object.keys(msg.payload)
            .map(k => k.split('.'))
            .filter(k => r[k[0]] !== undefined)
            .every(k => deref(r, k) === msg.payload[joinKey(k)]);
        });
        results = results.slice(-limit);
        [ since, until ] = results.length > 0 ?
          [ ptpMinusOne(results.slice(-1)[0].version), results[0].version ] :
          [ undefined, undefined ];
        // 'since' takes precedence and we're in reverse ... another documentation note

        if (first) {
          let linkBase = // TODO when should this be https?
            `<http://${msg.req.headers.host}/x-nmos/query/${msg.version}/${resourceType}/?`;
          let link =
            (since ? `${linkBase}paging.until=${formatTS(since)}&paging.limit=${limit}>; rel="prev", ` : '') +
            (until ? `${linkBase}paging.since=${formatTS(until)}&paging.limit=${limit}>; rel="next", ` : '') +
            `${linkBase}paging.since=${formatTS(ptpMinusOne(first))}&paging.limit=${limit}>; rel="first", ` +
            `${linkBase}paging.until=${last}&paging.limit=${limit}>; rel="last"`;
          msg.headers = {
            'Link': link,
            'X-Paging-Limit': limit.toString(),
            'X-Paging-Since': formatTS(ptpMinusOne(since)),
            'X-Paging-Until': formatTS(until)
          };
        } else {
          msg.headers = {
            'X-Paging-Limit': limit.toString()
          };
        }
        msg.type = 'store query response';
        msg.payload = results;

        return this.send(msg);
      }
      // TODO - send on other messages?
    });

    this.on('close', () => {
      store.clear();
      latest.clear();
    });
  }
  RED.nodes.registerType('state-store-RAM', StateStoreRAM);
};
