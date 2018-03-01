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
const dns = require('dns');

let dnsServ;
const zoneFilePath = `${__dirname}/../zoneFile.json`;

function createZoneFile() {
  let zoneObj = {};
  zoneObj.primaryNameservers = dns.getServers();

  zoneObj.domains = [{ id: 'zenmos.net', 'revokedAt': 0 }];

  zoneObj.records = [];
  zoneObj.records.push({ zone: 'zenmos.net', name: 'zenmos.net', type: 'NS', class: 'IN', ttl: 255, tld: 'net', sld: 'zenmos', sub: 'ns1', data: 'ns1.zenmos.net' });
  zoneObj.records.push({ zone: 'zenmos.net', name: 'ns1.zenmos.net', type: 'A', class: 'IN', ttl: 255, tld: 'net', sld: 'zenmos', sub: 'ns1', 'address': '127.0.0.1' });
  zoneObj.records.push({ zone: 'zenmos.net', name: 'zenmos.net', type: 'A', class: 'IN', ttl: 255, tld: 'net', sld: 'zenmos', address: '127.0.0.1' });

  zoneObj.records.push({ zone: 'zenmos.net', name: 'b._dns-sd._udp.zenmos.net', type: 'PTR', class: 'IN', ttl: 255, data: 'ns1.zenmos.net'});
  zoneObj.records.push({ zone: 'zenmos.net', name: 'db._dns-sd._udp.zenmos.net', type: 'PTR', class: 'IN', ttl: 255, data: 'ns1.zenmos.net'});
  zoneObj.records.push({ zone: 'zenmos.net', name: 'lb._dns-sd._udp.zenmos.net', type: 'PTR', class: 'IN', ttl: 255, data: 'ns1.zenmos.net'});

  zoneObj.records.push({ zone: 'zenmos.net', name: '_services._dns-sd._udp.zenmos.net', type: 'PTR', class: 'IN', 'ttl': 255, data: '_nmos-registration._tcp'});
  zoneObj.records.push({ zone: 'zenmos.net', name: '_services._dns-sd._udp.zenmos.net', type: 'PTR', class: 'IN', 'ttl': 255, data: '_nmos-query._tcp'});

  zoneObj.records.push({ zone: 'zenmos.net', name: '_nmos-registration._tcp.zenmos.net', type: 'PTR', class: 'IN', 'ttl': 255, data: 'regsrv-1._nmos-registration._tcp.zenmos.net'});
  zoneObj.records.push({ zone: 'zenmos.net', name: 'regsrv-1._nmos-registration._tcp.zenmos.net', type: 'SRV', class: 'IN', 'ttl': 255, priority: 10, weight: 5, port: 3001, target: '127.0.0.1'});
  zoneObj.records.push({ zone: 'zenmos.net', name: 'regsrv-1._nmos-registration._tcp.zenmos.net', type: 'TXT', class: 'IN', 'ttl': 255, data: ['api_proto=http', 'api_ver=v1.0', 'pri=10']});

  zoneObj.records.push({ zone: 'zenmos.net', name: '_nmos-query._tcp.zenmos.net', type: 'PTR', class: 'IN', 'ttl': 255, data: 'querysrv-1._nmos-query._tcp.zenmos.net'});
  zoneObj.records.push({ zone: 'zenmos.net', name: 'querysrv-1._nmos-query._tcp.zenmos.net', type: 'SRV', class: 'IN', 'ttl': 255, priority: 10, weight: 5, port: 3002, target: '127.0.0.1'});
  zoneObj.records.push({ zone: 'zenmos.net', name: 'querysrv-1._nmos-query._tcp.zenmos.net', type: 'TXT', class: 'IN', 'ttl': 255, data: ['api_proto=http', 'api_ver=v1.0', 'pri=10']});

  fs.writeFileSync(zoneFilePath, JSON.stringify(zoneObj));
}

function createDnsServer(zoneFile, config, cb) {
  dnsServ = require('child_process').fork(
    `${__dirname}/../node_modules/digd.js`, 
    [ 
      '+notcp', 
      '--debug=false',
      '--send=true',
      `--input=${zoneFile}`,
      `--address=${config.interface}`
    ], 
    { silent: true }
  );

  dnsServ.on('error', err => { 
    cb(err);
  });

  dnsServ.on('exit', () => {
    console.log('Stopped DNS server');
  });

  dnsServ.on('message', m => {
    if (m.ready) {
      console.log('Started DNS server:', m.ready);
    } else {
      cb(null, m);
    }
  });
}

module.exports = function (RED) {
  function dns_sd (config) {
    RED.nodes.createNode(this, config);

    createZoneFile(config);

    createDnsServer(zoneFilePath, config, (err, msg) => {
      if (err) {
        console.log('Error from DNS server:', err);
      } else {
        let msgid = RED.util.generateId();
        if (msg.query) {
          this.send({
            type: 'DNS-SD QUERY',
            _msgid: msgid,
            payload: msg.query
          });
        } else if (msg.local) {
          this.send({
            type: 'DNS-SD LOCAL RESPONSE',
            _msgid: msgid,
            payload: msg.local
          });
        } else {
          this.send({
            type: 'DNS-SD RESPONSE',
            _msgid: msgid,
            payload: msg.recurse
          });
        }
      }
    });
      
    this.on('close', done => {
      dnsServ.kill();
      done();
    });
  }
  RED.nodes.registerType('DNS-SD', dns_sd);
};
