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

const { promisify } = require('util');
const fs = require('fs');
const [ readFile, readdir ] = [ promisify(fs.readFile), promisify(fs.readdir) ];
const path = require('path');
const Ajv = require('ajv');

// Load schema functions

function loadSchema(dir, v) {
  let ajv = new Ajv({schemaId: 'auto', allErrors: true});
  ajv.addMetaSchema(require('ajv/lib/refs/json-schema-draft-04.json'));
  return readdir(dir).then(schemaList => Promise.all(
    schemaList
      .filter(x => x.endsWith('.json'))
      .map(x => readFile(path.join(dir, x))
        .then(JSON.parse)
        .then(y => {
          ajv.addSchema(y, x);
        }))).then(() => { return { v: v, ajv: ajv }; }) );   // console.log(ajv.getSchema('flow.json'));
}

module.exports = function (RED) {
  const schemas = new Map;
  function JSONValidator (config) {
    RED.nodes.createNode(this, config);

    let readSchemas = [];

    switch (config.nmosVersion) {
    case 'v12': {
      readSchemas.push(loadSchema(__dirname + '/../schemas/v1.2.x/', 'v1.2'));
      break;
    }
    case 'v11': {
      readSchemas.push(loadSchema(__dirname + '/../schemas/v1.1.x/', 'v1.1'));
      break;
    }
    case 'v10': {
      readSchemas.push(loadSchema(__dirname + '/../schemas/v1.0.x/', 'v1.0'));
      break;
    }
    case 'all':
    default: {
      readSchemas.push(loadSchema(__dirname + '/../schemas/v1.2.x/', 'v1.2'));
      readSchemas.push(loadSchema(__dirname + '/../schemas/v1.1.x/', 'v1.1'));
      readSchemas.push(loadSchema(__dirname + '/../schemas/v1.0.x/', 'v1.0'));
      break;
    }
    }

    Promise.all(readSchemas).then(loaded => {
      loaded.forEach(s => { schemas.set(s.v, s.ajv); });
      this.on('input', msg => {
        msg = Object.assign({}, msg);
        if ((msg.type === 'HTTP REQ POST') &&
          (typeof msg.validated !== 'undefined') && (msg.validated === false)) {
          let [ resourceType, body ] = msg.req.params.resource === 'resource' ?
            [ msg.payload.type, msg.payload.data ] :
            [ msg.req.params.resource, msg.payload ];
          if (msg.req.params.id) {
            resourceType = resourceType.slice(0, -1); // Chop off the last 's'
          }
          let ajv = schemas.get(msg.version);
          if (!ajv) {
            msg.valid = false;
            msg.validated = true;
            msg.payload = `Not set up to validate messages with version ${msg.version}.`;
            return this.send(msg);
          }
          let valid = ajv.validate(`${resourceType}.json`, body);
          msg.validated = true;
          if (valid) {
            msg.valid = true;
            return this.send(msg);
          }
          else {
            msg.valid = false;
            msg.input = msg.payload;
            msg.payload = ajv.errors;
            return this.send(msg);
          }
        }
        return;
      });
    });

    this.on('close', () => {
      schemas.clear();
    });
  }
  RED.nodes.registerType('json-validator', JSONValidator);
};
