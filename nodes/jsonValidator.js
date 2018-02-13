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
  let schemaList = readdir(dir);
  return Promise.all(
    schemaList
      .filter(x => x.endsWith('.json'))
      .map(x => readFile(path.join(dir, x))
        .then(JSON.parse)
        .then(y => {
          ajv.addSchema(y, x);
        }))).then(() => ({ v, ajv }));   // console.log(ajv.getSchema('flow.json'));
}

module.exports = function (RED) {
  const schemas = new Map;
  function JSONValidator (config) {
    RED.nodes.createNode(this, config);

    let readSchemas = [];

    switch (config.nmosVersion) {
    case 'v12': {
      readSchemas.push(loadSchema('../schemas/v1.2.x/', 'v.1.2.x'));
      break;
    }
    case 'v11': {
      readSchemas.push(loadSchema('../schemas/v1.1.x/', 'v1.1.x'));
      break;
    }
    case 'v10': {
      readSchemas.push(loadSchema('../schemas/v1.0.x/', 'v1.0.x'));
      break;
    }
    case 'all':
    default: {
      readSchemas.push(loadSchema('../schemas/v1.2.x/', 'v1.2.x'));
      readSchemas.push(loadSchema('../schemas/v1.1.x/', 'v1.1.x'));
      readSchemas.push(loadSchema('../schemas/v1.0.x/', 'v1.0.x'));
      break;
    }
    }

    Promise.all(readSchemas).then(loaded => {
      loaded.forEach(s => { schemas.set(s.v, s.ajv); });
      this.on('input', msg => {
        if ((msg.payload.type === 'HTTPRequest') &&
          (msg.payload.valid === undefined)) {
          let resourceType = msg.payload.resourceType;
          let body = msg.payload.body;
          let ajv = schemas.get(msg.payload.nmosVersion);
          let valid = ajv.validate(`${resourceType}.json`, body);
          if (valid) {
            msg.payload.valid = true;
            return this.send(msg);
          }
          if (!valid) {
            msg.payload.valid = false;
            msg.payload.validationErrors = ajv.errors;
            return this.send(msg);
          }
        }
        return;
      });
    });

    this.on('close', this.close);
  }
  RED.nodes.registerType('json-validator', JSONValidator);
};
