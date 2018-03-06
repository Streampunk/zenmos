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

const fs = require('fs');

function createZoneFile(config) {
  let zoneObj = {};
  zoneObj.primaryNameservers = [];

  zoneObj.domains = [];

  zoneObj.records = [];
  zoneObj.records.push({ zone: 'local', name: '_services._dns-sd._udp.local', type: 'PTR', class: 'IN', 'ttl': 255, data: '_nmos-registration._tcp.local'});
  zoneObj.records.push({ zone: 'local', name: '_services._dns-sd._udp.local', type: 'PTR', class: 'IN', 'ttl': 255, data: '_nmos-query._tcp.local'});

  zoneObj.records.push({ zone: 'local', name: '_nmos-registration._tcp.local', type: 'PTR', class: 'IN', 'ttl': 255, data: 'regsrv-1._nmos-registration._tcp.local'});
  zoneObj.records.push({ zone: 'local', name: 'regsrv-1._nmos-registration._tcp.local', type: 'A', class: 'IN', 'ttl': 255, address: '127.0.0.1'});
  zoneObj.records.push({ zone: 'local', name: 'regsrv-1._nmos-registration._tcp.local', type: 'SRV', class: 'IN', 'ttl': 255, priority: 10, weight: 5, port: 3001, target: 'regsrv-1._nmos-registration._tcp.local'});
  zoneObj.records.push({ zone: 'local', name: 'regsrv-1._nmos-registration._tcp.local', type: 'TXT', class: 'IN', 'ttl': 255, data: ['api_proto=http', 'api_ver=v1.0', 'pri=10']});

  zoneObj.records.push({ zone: 'local', name: '_nmos-query._tcp.local', type: 'PTR', class: 'IN', 'ttl': 255, data: 'querysrv-1._nmos-query._tcp.local'});
  zoneObj.records.push({ zone: 'local', name: 'querysrv-1._nmos-query._tcp.local', type: 'A', class: 'IN', 'ttl': 255, address: '127.0.0.1'});
  zoneObj.records.push({ zone: 'local', name: 'querysrv-1._nmos-query._tcp.local', type: 'SRV', class: 'IN', 'ttl': 255, priority: 10, weight: 5, port: 3002, target: 'querysrv-1._nmos-query._tcp.local'});
  zoneObj.records.push({ zone: 'local', name: 'querysrv-1._nmos-query._tcp.local', type: 'TXT', class: 'IN', 'ttl': 255, data: ['api_proto=http', 'api_ver=v1.0', 'pri=10']});

  const zoneFilePath = `${__dirname}/../zoneFiles/${config.id}.json`;
  fs.writeFileSync(zoneFilePath, JSON.stringify(zoneObj));
  return zoneFilePath;
}

function createDnsServer(zoneFile, config, cb) {
  const address = config.interface||'0.0.0.0';

  const dnsServ = require('child_process').fork(
    `${__dirname}/../node_modules/digd.js`,
    [ 
      '+notcp',
      '--debug=false',
      '--mdns=true',
      '--send=true',
      `--input=${zoneFile}`,
      `--address=${address}`
    ], 
    { silent: true }
  );

  dnsServ.on('error', err => { 
    cb(err);
  });

  dnsServ.on('exit', () => {
    console.log('Stopped mDNS server');
  });

  dnsServ.on('message', m => {
    if (m.ready) {
      console.log('Started mDNS server:', m.ready);
    } else {
      cb(null, m);
    }
  });

  return dnsServ;
}

module.exports = function (RED) {
  function mdns (config) {
    RED.nodes.createNode(this, config);

    const zoneFilePath = createZoneFile(config);

    const dnsServ = createDnsServer(zoneFilePath, config, (err, msg) => {
      if (err) {
        console.log('Error from mDNS server:', err);
      } else {
        let msgid = RED.util.generateId();
        if (msg.query) {
          this.send({
            type: 'mDNS QUERY',
            _msgid: msgid,
            payload: msg.query
          });
        } else if (msg.local) {
          this.send({
            type: 'mDNS RESPONSE',
            _msgid: msgid,
            payload: msg.local
          });
        }
      }
    });
      
    this.on('close', done => {
      dnsServ.kill();
      fs.unlinkSync(zoneFilePath);
      done();
    });
  }
  RED.nodes.registerType('mDNS', mdns);
};
