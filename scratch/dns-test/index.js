/* Copyright 2016 Streampunk Media Ltd.

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
'use strict';

const util = require('util');
const dns = require('dns');

dns.setServers(['127.0.0.1']);

const regSrvName = '_nmos-registration._tcp.zenmos.net';
const findPtr = util.promisify(dns.resolvePtr);
const findSrv = util.promisify(dns.resolveSrv);
const findTxt = util.promisify(dns.resolveTxt);

let inst;
let srv;
findPtr(regSrvName)
.then(p => {
  inst = p[0];
  return findSrv(inst);
})
.then(s => { 
  srv = s[0];
  srv.name = inst;
  return findTxt(inst); 
})
.then(t => { srv.txt = t[0]; console.log(JSON.stringify(srv, null, 2)); })
.catch(err => console.log(err));

