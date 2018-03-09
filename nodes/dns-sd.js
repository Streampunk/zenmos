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
const os = require('os');

function getIPAddress(name) {
  const interfaces = os.networkInterfaces();
  const candidateInterfaces = [];
  Object.keys(interfaces).forEach(ifname => {
    interfaces[ifname].forEach(iface => {
      if ('IPv4' === iface.family && !iface.internal)
        candidateInterfaces.push({ name: ifname, address: iface.address });
    });
  });

  const defaultAddress = candidateInterfaces.length ? candidateInterfaces[0].address : '127.0.0.1';
  const selInterface = candidateInterfaces.find(i => i.name === name || i.address === name);
  return selInterface ? selInterface.address : defaultAddress;
}

function createZoneFile(config) {
  const aEnabled = config.aEnabled;
  const aService = config.aService || 'nmos-registration';
  const aName = `asrv-${config.id.split('.').join('')}`;
  const aAddr = getIPAddress(config.aInterface);
  const aPort = config.aPort || 3001;
  const aTTL = config.aTTL || 255;
  const aPriority = config.aPriority || 100;
  const aTXT = config.aTXT ? config.aTXT.split(',') : [];

  const bEnabled = config.bEnabled;
  const bService = config.bService || 'nmos-query';
  const bName = `bsrv-${config.id.split('.').join('')}`;
  const bAddr = getIPAddress(config.bInterface);
  const bPort = config.bPort || 3002;
  const bTTL = config.bTTL || 255;
  const bPriority = config.bPriority || 100;
  const bTXT = config.bTXT ? config.bTXT.split(',') : [];

  let zoneObj = {};
  zoneObj.primaryNameservers = dns.getServers();

  zoneObj.domains = [{ id: 'zenmos.net', 'revokedAt': 0 }];

  zoneObj.records = [];
  zoneObj.records.push({ zone: 'zenmos.net', name: 'zenmos.net', type: 'NS', class: 'IN', ttl: 43200, tld: 'net', sld: 'zenmos', sub: 'ns1', data: 'ns1.zenmos.net' });
  zoneObj.records.push({ zone: 'zenmos.net', name: 'ns1.zenmos.net', type: 'A', class: 'IN', ttl: 43200, tld: 'net', sld: 'zenmos', sub: 'ns1', 'address': '127.0.0.1' });
  zoneObj.records.push({ zone: 'zenmos.net', name: 'zenmos.net', type: 'A', class: 'IN', ttl: 43200, tld: 'net', sld: 'zenmos', address: '127.0.0.1' });

  zoneObj.records.push({ zone: 'zenmos.net', name: 'b._dns-sd._udp.zenmos.net', type: 'PTR', class: 'IN', ttl: 43200, data: 'ns1.zenmos.net' });
  zoneObj.records.push({ zone: 'zenmos.net', name: 'db._dns-sd._udp.zenmos.net', type: 'PTR', class: 'IN', ttl: 43200, data: 'ns1.zenmos.net' });
  zoneObj.records.push({ zone: 'zenmos.net', name: 'lb._dns-sd._udp.zenmos.net', type: 'PTR', class: 'IN', ttl: 43200, data: 'ns1.zenmos.net' });

  if (aEnabled)
    zoneObj.records.push({ zone: 'zenmos.net', name: '_services._dns-sd._udp.zenmos.net', type: 'PTR', class: 'IN', 'ttl': 43200, data: `_${aService}._tcp.zenmos.net` });
  if (bEnabled)
    zoneObj.records.push({ zone: 'zenmos.net', name: '_services._dns-sd._udp.zenmos.net', type: 'PTR', class: 'IN', 'ttl': 43200, data: `_${bService}._tcp.zenmos.net` });

  if (aEnabled) {
    zoneObj.records.push({ zone: 'zenmos.net', name: `_${aService}._tcp.zenmos.net`, type: 'PTR', class: 'IN', 'ttl': aTTL, data: `${aName}._${aService}._tcp.zenmos.net` });
    zoneObj.records.push({ zone: 'zenmos.net', name: `${aName}._${aService}._tcp.zenmos.net`, type: 'SRV', class: 'IN', 'ttl': aTTL, priority: aPriority, weight: 5, port: aPort, target: `${aName}.zenmos.net` });
    zoneObj.records.push({ zone: 'zenmos.net', name: `${aName}._${aService}._tcp.zenmos.net`, type: 'TXT', class: 'IN', 'ttl': aTTL, data: aTXT });
    zoneObj.records.push({ zone: 'zenmos.net', name: `${aName}.zenmos.net`, type: 'A', class: 'IN', 'ttl': aTTL, address: aAddr });
  }

  if (bEnabled) {
    zoneObj.records.push({ zone: 'zenmos.net', name: `_${bService}._tcp.zenmos.net`, type: 'PTR', class: 'IN', 'ttl': bTTL, data: `${bName}._${bService}._tcp.zenmos.net` });
    zoneObj.records.push({ zone: 'zenmos.net', name: `${bName}._${bService}._tcp.zenmos.net`, type: 'SRV', class: 'IN', 'ttl': bTTL, priority: bPriority, weight: 5, port: bPort, target: `${bName}.zenmos.net` });
    zoneObj.records.push({ zone: 'zenmos.net', name: `${bName}._${bService}._tcp.zenmos.net`, type: 'TXT', class: 'IN', 'ttl': bTTL, data: bTXT });
    zoneObj.records.push({ zone: 'zenmos.net', name: `${bName}.zenmos.net`, type: 'A', class: 'IN', 'ttl': bTTL, address: bAddr });
  }

  const zoneFilePath = `${__dirname}/../zoneFiles/${config.id}.json`;
  fs.writeFileSync(zoneFilePath, JSON.stringify(zoneObj));
  return zoneFilePath;
}

function createDnsServer(zoneFile, config, cb) {
  const dnsAddress = config.interface||'0.0.0.0';

  const dnsServ = require('child_process').fork(
    `${__dirname}/../node_modules/digd.js`, 
    [ 
      '+notcp', 
      '--debug=false',
      '--send=true',
      `--input=${zoneFile}`,
      `--address=${dnsAddress}`
    ], 
    { silent: true }
  );

  dnsServ.stdout.on('data', () => {});
  dnsServ.stderr.on('data', data => console.log(`DNS server internal error: ${data}`));

  dnsServ.on('close', code => console.log(`DNS server exited with code ${code}`));
  dnsServ.on('error', err => cb(err));
  dnsServ.on('exit', () => console.log('Stopped DNS server'));

  dnsServ.on('message', m => {
    if (m.ready) {
      console.log('Started DNS server:', m.ready);
    } else {
      cb(null, m);
    }
  });

  return dnsServ;
}

function filterDNS_SD(records) {
  return records.find(r => r.name.indexOf('nmos') >= 0 || r.name.indexOf('dns-sd') >= 0);
}

module.exports = function (RED) {
  function dns_sd (config) {
    RED.nodes.createNode(this, config);

    const zoneFilePath = createZoneFile(config);

    const dnsServ = createDnsServer(zoneFilePath, config, (err, msg) => {
      if (err) {
        console.log('Error from DNS server:', err);
      } else {
        if ((msg.query && filterDNS_SD(msg.query.question)) ||
            (msg.local && filterDNS_SD(msg.local.answer)) ||
            (msg.recurse && filterDNS_SD(msg.recurse.answer))) {
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
      }
    });
      
    this.on('close', done => {
      dnsServ.kill();
      fs.unlinkSync(zoneFilePath);
      done();
    });
  }
  RED.nodes.registerType('DNS-SD', dns_sd);
};
