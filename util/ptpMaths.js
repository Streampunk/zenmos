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

const nineZeros = '000000000';
const maxPTP = `${Number.MAX_SAFE_INTEGER}:000000000`;
const stampPattern = /^([0-9]+):([0-9]+)$/;

const dateNow = () => (d => [ d / 1000 | 0, d % 1000 * 1000000])(Date.now());

function extractVersions(v) {
  if (Array.isArray(v)) return v;
  var m = stampPattern.exec(v);
  if (m === null) { return typeof v === 'number' ?
    [v / 1000 | 0, (v % 1000) * 1000000 | 0] : [Number.MAX_SAFE_INTEGER, 0]; }
  return [+m[1], +m[2]];
}

const formatTS = ts => {
  ts = extractVersions(ts);
  let ts1 = ts[1].toString();
  return `${ts[0]}:${nineZeros.slice(0, -ts1.length)}${ts1}`;
};

const ptpMinusOne = ts => {
  let [ ts1, ts2 ] = extractVersions(ts);
  ts2 = ts2 - 1;
  if (ts2 === -1) { ts1 = ts1 - 1; ts2 = 0; }
  return [ ts1, ts2 ];
};

function compareVersions(l, r) {
  var lm = extractVersions(l);
  var rm = extractVersions(r);
  if (lm[0] < rm[0]) return -1;
  if (lm[0] > rm[0]) return 1;
  if (lm[1] < rm[1]) return -1;
  if (lm[1] > rm[1]) return 1;
  return 0;
}

module.exports = {
  formatTS,
  ptpMinusOne,
  compareVersions,
  extractVersions,
  dateNow,
  maxPTP,
  stampPattern,
  versionTS: () => formatTS(dateNow())
};
