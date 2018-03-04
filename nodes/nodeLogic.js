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

const os = require('os');
const uuidv4 = require('uuid/v4');

module.exports = function (RED) {
  const knownResources =
    [ 'self', 'devices', 'sources', 'flows', 'senders', 'receivers'];
  const supportedVersions = [ 'v1.0', 'v1.1', 'v1.2'];
  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89abAB][0-9a-f]{3}-[0-9a-f]{12}$/;
  const store = new Map; // current internal state of the node

  const dateNow = () => (d => [ d / 1000 | 0, d % 1000 * 1000000])(Date.now());
  const nineZeros = '000000000';
  const formatTS = ts => {
    let ts1 = ts[1].toString();
    return `${ts[0]}:${nineZeros.slice(0, -ts1.length)}${ts1}`;
  };
  const findOne = type => {
    let a = [];
    for ( let [k, v] of store ) {
      if (k.startsWith(type)) {
        a.push(v.id);
      }
    }
    return a[ Math.random() * a.length | 0 ];
  };

  const selfMaker = config => ({
    version: formatTS(dateNow()),
    hostname: config.hostname ? config.hostname : os.hostname(),
    caps: {},
    href: 'http://172.29.80.65:12345/',
    api: config.nmosVersion === 'v10' ? undefined : {
      versions: [ 'v1.0', 'v1.1', 'v1.2' ],
      endpoints: [ {
        host: '172.29.80.65',
        port: 12345,
        protocol: 'http'
      }, {
        host: '172.29.80.65',
        port: 443,
        protocol: 'https'
      } ]
    },
    services: [ {
      href: 'http://172.29.80.65:12345/x-manufacturer/pipelinemanager/',
      type: 'urn:x-manufacturer:service:pipelinemanager'
    }, {
      href: 'http://172.29.80.65:12345/x-manufacturer/status/',
      type: 'urn:x-manufacturer:service:status'
    } ],
    label: config.label ? config.label : `${os.hostname()}-label`,
    description: config.description ?
      config.description :
      `${os.hostname()}-description`,
    tags: {},
    id: config.selfID,
    clocks: config.nmosVersion === 'v10' ? undefined : [ {
      name: 'clk0',
      ref_type : 'internal'
    }, {
      name: 'clk1',
      ref_type: 'ptp',
      traceable: true,
      version: 'IEEE1588-2008',
      gmid: '08-00-11-ff-fe-21-e1-b0',
      locked: true
    } ],
    interfaces: config.nmosVersion === 'v10' ? undefined : [ {
      name: 'eth0',
      chassis_id: '74-26-96-db-87-31',
      port_id: '74-26-96-db-87-31'
    }, {
      name: 'eth1',
      chassis_id: '74-26-96-db-87-31',
      port_id: '74-26-96-db-87-32'
    } ]
  });
  const deviceMaker = config => ({
    receivers: [],
    label: 'pipeline 1 default device',
    description: 'pipeline 1 default device',
    tags: {},
    version: formatTS(dateNow()),
    id: uuidv4(),
    type: 'urn:x-nmos:device:pipeline',
    senders: [],
    node_id: config.selfID,
    controls: config.nmosVersion === 'v10' ? undefined : [ {
      type: 'urn:x-manufacturer:control:generic',
      href: 'ws://182.54.54.75:223'
    }, {
      type: 'urn:x-manufacturer:control:generic',
      href: 'http://134.24.64.22/x-manufacturer/control/'
    }, {
      type: 'urn:x-manufacturer:control:legacy',
      href: 'telnet://120.43.64.3:8080'
    } ]
  });
  const sourceMaker = config => ({
    description: 'Capture Card Source Video',
    tags: {
      'host': [ 'host1' ]
    },
    format: 'urn:x-nmos:format:video',
    caps: {},
    version: formatTS(dateNow()),
    parents: [],
    label: 'CaptureCardSourceVideo',
    id: uuidv4(),
    device_id: findOne('device'),
    clock_name: config.nmosVersion === 'v10' ? undefined : 'clk1'
  });
  const flowMaker = config => ({
    description: 'Test Card',
    tags: {},
    format: 'urn:x-nmos:format:video',
    label: 'Test Card',
    version: formatTS(dateNow()),
    parents: [],
    source_id: findOne('sources'),
    device_id: findOne('devices'), // TODO make this the sources flow
    id: uuidv4(),
    media_type: config.nmosVersion === 'v10' ? undefined : 'video/raw',
    frame_width: config.nmosVersion === 'v10' ? undefined : 1920,
    frame_height: config.nmosVersion === 'v10' ? undefined : 1080,
    interlace_mode: config.nmosVesion === 'v10' ? undefined : 'interlaced_tff',
    colorspace: config.nmosVesion === 'v10' ? undefined : 'BT709',
    components: config.nmosVesion === 'v10' ? undefined : [ {
      name: 'Y',
      width: 1920,
      height: 1080,
      bit_depth: 10
    }, {
      name: 'Cb',
      width: 960,
      height: 1080,
      bit_depth: 10
    }, {
      name: 'Cr',
      width: 960,
      height: 1080,
      bit_depth: 10
    } ]
  });
  const senderMaker = config => ({
    description: 'Test Card',
    label: 'Test Card',
    version: formatTS(dateNow()),
    manifest_href: 'http://172.29.80.65/x-manufacturer/senders/d7aa5a30-681d-4e72-92fb-f0ba0f6f4c3e/stream.sdp',
    flow_id: findOne('flows'),
    id: uuidv4(),
    transport: 'urn:x-nmos:transport:rtp.mcast',
    device_id: findOne('devices'),
    interface_bindings: config.nmosVersion === 'v10' ? undefined : [
      'eth0',
      'eth1'
    ],
    caps: {},
    tags: {},
    subscription: {
      receiver_id: null,
      active: config.nmosVersion === 'v10' ? undefined : true
    }
  });
  const receiverMaker = config => ({
    description: 'RTPRx-description',
    format: 'urn:x-nmos:format:video',
    tags: {},
    caps: {
      media_types: [ 'video/raw' ]
    },
    subscription: {
      sender_id: findOne('senders'),
      active: config.nmosVersion === 'v10' ? undefined : true
    },
    version: formatTS(dateNow()),
    label: 'RTPRx',
    id: uuidv4(),
    transport: 'urn:x-nmos:transport:rtp',
    interface_bindings: config.nmosVersion === 'v10' ? undefined : [
      'eth0',
      'eth1'
    ],
    device_id: findOne('devices')
  });

  function NodeLogic (config) {
    RED.nodes.createNode(this, config);

    if (!config.selfID) {
      config.selfID = uuidv4();
    }
    (s => store.set(`self_${s.id}`, s))(selfMaker(config));
    // Add other types here
    for ( let x = 0 ; x < config.devices ; x++ ) {
      (s => store.set(`devices_${s.id}`, s))(deviceMaker(config));
    }
    for ( let x = 0 ; x < config.sources ; x++ ) {
      (s => store.set(`sources_${s.id}`, s))(sourceMaker(config));
    }
    for ( let x = 0 ; x < config.flows ; x++ ) {
      (s => store.set(`flows_${s.id}`, s))(flowMaker(config));
    }
    for ( let x = 0 ; x < config.senders ; x++ ) {
      (s => store.set(`senders_${s.id}`, s))(senderMaker(config));
    }
    for ( let x = 0 ; x < config.receivers ; x++ ) {
      (s => store.set(`receivers_${s.id}`, s))(receiverMaker(config));
    }

    this.on('input', msg => {
      msg = Object.assign({}, msg);
      let msgType = msg.type;

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

      if (supportedVersions.indexOf(msg.version) < 0) {
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
        // TODO read the resources from the store
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
      let resource = store.get(storeKey);
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

  }
  RED.nodes.registerType('node-logic', NodeLogic);
};
