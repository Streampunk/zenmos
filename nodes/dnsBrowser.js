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

const dnsjs = require('dns-suite');

function createUDPListener(options, cb) {
  const socket = require('dgram').createSocket({ type: 'udp4', reuseAddr: true });
  socket.bind({ address: options.address, port: options.port });

  var handlers = {};
  handlers.onError = function (err) {
    if ('EACCES' === err.code) {
      console.error('');
      console.error('EACCES: Couldn\'t bind to port. You probably need to use sudo, authbind, or setcap.');
      console.error('');
      process.exit(123);
      return;
    }
    console.error('error:', err.stack);
    socket.close();
  };

  handlers.onMessage = function (nb, rinfo) {
    if (rinfo.port === options.port) {
      try {
        cb(null, dnsjs.DNSPacket.parse(nb), rinfo);
      } catch(e) {
        console.error('Could not parse DNS query, ignoring.');
      }
    }
  };

  handlers.onListening = function () {
    if (options.mdns)
      socket.addMembership('224.0.0.251');
    console.log(`Started ${options.mdns?'m':''}DNS Browser at '${socket.address().address}:${socket.address().port}'`);
  };

  socket.on('error', handlers.onError);
  socket.on('message', handlers.onMessage);
  socket.on('listening', handlers.onListening);

  return socket;
}

module.exports = function (RED) {
  function DNSBrowser (config) {
    RED.nodes.createNode(this, config);

    const mdns = !(config.unicast || false);
    const address = config.interface || '127.0.0.1';
    const unicastDomain = config.unicastDomain || 'zenmos.net';
    const port = mdns ? 5353 : 53;
    const timeout = 1000;
    const domain = mdns ? 'local' : unicastDomain;
    const dns_sd_query = `_services._dns-sd._udp.${domain}`;

    function makeQuery(name, typeName) {
      const types = {
        A:    0x1,  // 1
        PTR:  0xc,  // 12
        TXT:  0x10, // 16
        AAAA: 0x1c, // 28
        SRV:  0x21  // 33
      };
    
      return {
        header: { id: require('crypto').randomBytes(2).readUInt16BE(0), qr: 0, opcode: 0, aa: 0, tc: 0, rd: 0, ra: 0, rcode: 0 }
        , question: [{ name: name, type: types[typeName], typeName: typeName, class: mdns?0x8001:1, className: 'IN' }]
        , answer: []
        , authority: []
        , additional: []
      };
    }

    const services = [];
    function checkService(service) {
      if (mdns)
        console.log(`DNS Browser: insufficient data received for ${service.name} after ${timeout}ms`);
      if (service.instance) {
        if (!service.target)
          send(makeQuery(service.instance, 'SRV'));
        if (!service.txt.length)
          send(makeQuery(service.instance, 'TXT'));
      } else if (service.target) {
        send(makeQuery(service.target, 'A'));
      }
      else
        send(makeQuery(service.name, 'PTR'));
    }

    function parseRecord(service, r, additional) {
      switch (r.typeName) {
      case 'PTR':
        service.instance = r.data;
        if (additional)
          service.debug.push('Unexpected PTR record in additional records', r.name);
        break;
      case 'SRV':
        service.target = r.target;
        service.port = r.port;
        if (!service.address)
          service.address = r.target;
        break;
      case 'TXT':
        service.txt = r.data;
        break;
      case 'A':
      case 'AAAA':
        service.address = r.address;
        break;
      default: 
        service.debug.push(`Unexpected packet type '${r.typeName}' name '${r.name} in additional record`);
      }
    }

    const bindPort = mdns ? port : 0;
    const bindAddress = '127.0.0.1' === address ? '0.0.0.0' : address; 
    const socket = createUDPListener({ address: bindAddress, port: bindPort, mdns: mdns }, (err, packet, rinfo) => {
      if (err)
        console.error(`Error from ${rinfo.address}:${rinfo.port}: `, err);
      else {
        packet.answer.forEach(a => {
          if (a.name === dns_sd_query && a.data.indexOf('nmos') >= 0) {
            if (!services.find(s => s.name === a.data)) {
              const service = {
                discovery: (5353 === rinfo.port) ? 'multicast' : 'unicast',
                debug: [],
                name: a.data, 
                ttl: a.ttl, 
                txt: [],
                insufficient: setInterval(() => {
                  let msgid = RED.util.generateId();
                  this.send({
                    type: 'DNS Browser incomplete service',
                    _msgid: msgid,
                    payload: service
                  });

                  checkService(service);
                }, timeout)
              };
              services.push(service);
            }
          } else if (a.name.indexOf('nmos') >= 0) {
            const service = services.find(s => a.name.indexOf(s.name) >= 0);
            if (service) {
              parseRecord(service, a);
              packet.additional.forEach(add => parseRecord(service, add));
              if (service.instance && service.target && service.txt && service.address && service.insufficient) {
                clearTimeout(service.insufficient);
                delete service.insufficient;

                let msgid = RED.util.generateId();
                this.send({
                  type: 'DNS Browser new service',
                  _msgid: msgid,
                  payload: service
                });
              }
            }
          }
        });
      }
    });

    function send(query) {
      const nb = dnsjs.DNSPacket.write(query);
      if (mdns)
        // mDNS requires id in response header to be 0. Force it here as DNSPacket.write doesn't know about mDNS
        nb.writeUInt16LE(0, 0);
  
      const sendAddress = mdns ? '224.0.0.251' : address;
      socket.send(nb, port, sendAddress);
    }

    setTimeout(() => send(makeQuery(dns_sd_query, 'PTR')), 1000);

    this.on('close', done => {
      socket.close();
      done();
    });
  }
  RED.nodes.registerType('DNS-Browser', DNSBrowser);
};
