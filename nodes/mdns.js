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
const os = require('os');
const path = require('path');

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
  zoneObj.primaryNameservers = [];

  zoneObj.domains = [];

  zoneObj.records = [];
  if (aEnabled)
    zoneObj.records.push({ zone: 'local', name: '_services._dns-sd._udp.local', type: 'PTR', class: 'IN', 'ttl': 43200, data: `_${aService}._tcp.local` });
  if (bEnabled)
    zoneObj.records.push({ zone: 'local', name: '_services._dns-sd._udp.local', type: 'PTR', class: 'IN', 'ttl': 43200, data: `_${bService}._tcp.local` });

  if (aEnabled) {
    zoneObj.records.push({ zone: 'local', name: `_${aService}._tcp.local`, type: 'PTR', class: 'IN', 'ttl': aTTL, data: `${aName}._${aService}._tcp.local` });
    zoneObj.records.push({ zone: 'local', name: `${aName}._${aService}._tcp.local`, type: 'SRV', class: 'IN', 'ttl': aTTL, priority: aPriority, weight: 5, port: aPort, target: `${aName}.local` });
    zoneObj.records.push({ zone: 'local', name: `${aName}._${aService}._tcp.local`, type: 'TXT', class: 'IN', 'ttl': aTTL, data: aTXT });
    zoneObj.records.push({ zone: 'local', name: `${aName}.local`, type: 'A', class: 'IN', 'ttl': aTTL, address: aAddr });
  }

  if (bEnabled) {
    zoneObj.records.push({ zone: 'local', name: `_${bService}._tcp.local`, type: 'PTR', class: 'IN', 'ttl': bTTL, data: `${bName}._${bService}._tcp.local` });
    zoneObj.records.push({ zone: 'local', name: `${bName}._${bService}._tcp.local`, type: 'SRV', class: 'IN', 'ttl': bTTL, priority: bPriority, weight: 5, port: bPort, target: `${bName}.local` });
    zoneObj.records.push({ zone: 'local', name: `${bName}._${bService}._tcp.local`, type: 'TXT', class: 'IN', 'ttl': bTTL, data: bTXT });
    zoneObj.records.push({ zone: 'local', name: `${bName}.local`, type: 'A', class: 'IN', 'ttl': bTTL, address: bAddr });
  }
  
  const zoneFileDir = path.join(__dirname, '..', 'zoneFiles');
  const zoneFilePath = path.join(zoneFileDir, `${config.id}.json`);
  if (!fs.existsSync(zoneFileDir))
    fs.mkdirSync(zoneFileDir);
  fs.writeFileSync(zoneFilePath, JSON.stringify(zoneObj));
  return zoneFilePath;
}

function createDnsServer(zoneFile, config, cb) {
  const mdnsAddress = config.interface||'0.0.0.0';

  const dnsServ = require('child_process').fork(
    path.join(__dirname, '..', 'node_modules', 'digd.js'),
    [
      '+notcp',
      '--debug=false',
      '--mdns=true',
      '--send=true',
      `--input=${zoneFile}`,
      `--address=${mdnsAddress}`
    ],
    { silent: true }
  );

  dnsServ.stdout.on('data', () => {});
  dnsServ.stderr.on('data', data => console.log(`mDNS server internal error: ${data}`));

  dnsServ.on('close', code => console.log(`mDNS server exited with code ${code}`));
  dnsServ.on('error', err => cb(err));
  dnsServ.on('exit', () => console.log('Stopped mDNS server'));

  dnsServ.on('message', m => {
    if (m.ready) {
      console.log('Started mDNS server:', m.ready);
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
  function mdns (config) {
    RED.nodes.createNode(this, config);

    const zoneFilePath = createZoneFile(config);

    const dnsServ = createDnsServer(zoneFilePath, config, (err, msg) => {
      if (err) {
        console.log('Error from mDNS server:', err);
      } else {
        if ((msg.query && filterDNS_SD(msg.query.question)) ||
            (msg.local && filterDNS_SD(msg.local.answer))) {
          const msgid = RED.util.generateId();
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
