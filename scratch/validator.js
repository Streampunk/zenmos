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

const yargs = require('yargs');
const { promisify } = require('util');
const fs = require('fs');
const [ readFile, readdir ] = [ promisify(fs.readFile), promisify(fs.readdir) ];
const path = require('path');
const Ajv = require('ajv');
var ajv = new Ajv({schemaId: 'auto', allErrors: true});
ajv.addMetaSchema(require('ajv/lib/refs/json-schema-draft-04.json'));

var args = yargs
  .demandCommand(2)
  .argv;

const schemaPath = path.resolve(args._[0]);
const instancePath = path.resolve(args._[1]);

async function checkIt(schemaFile, instanceFile) {
  try {
    let schemaList = await readdir(schemaFile);
    await Promise.all(
      schemaList
        .filter(x => x.endsWith('.json'))
        .map(x => readFile(path.join(schemaFile, x))
          .then(JSON.parse)
          .then(y => { ajv.addSchema(y, x); })));   // console.log(ajv.getSchema('flow.json'));
    var instance = await readFile(instanceFile).then(JSON.parse);
    let valid = ajv.validate('flow.json', instance);
    if (!valid) console.log(ajv.errors);
    else console.log('valid');
  } catch (e) { console.error(e); }
}

checkIt(schemaPath, instancePath);
