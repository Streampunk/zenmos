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

const request = require('request-promise-native');

module.exports = function (RED) {
  function NodeRequester (config) {
    RED.nodes.createNode(this, config);

    let heartBeat = null;
    let msgQueue = [];
    let basePath = config.discovery === 'manual' ? config.basePath : null;
    let latestServerTS = '0';
    let heartRate = +config.heartRate * 1000;

    const startBeat = (beatUrl, send) => {
      heartBeat = setTimeout(() => {
        request.post({ url: beatUrl, json: true, timeout: heartRate })
          .then(r => {
            latestServerTS = r.health;
            let beatMsg = {
              type: 'HEARTBEAT ROUNDTRIP',
              payload: {
                url: beatUrl,
                latestServerTS: latestServerTS
              }
            };
            send(beatMsg);
            startBeat(beatUrl, send);
          })
          .catch(e => {
            this.warn(`Received error when POSTing hearbeat to ${beatUrl}: ${e}`);
            if (e.name === 'StatusCodeError') {
              if (e.statusCode === 404) {
                let msg = {
                  type: 'HEARTBEAT 404 GC', // Garbage collected - re-register
                  payload: {
                    code: e.statusCode,
                    error: e,
                    debug: beatUrl
                  }
                };
                heartBeat = null;
                return send(msg);
              }
            } else {
              let msg = {
                type: 'HEARTBEAT FAIL',
                payload: {
                  error: e,
                  debug: beatUrl
                }
              };
              heartBeat = null;
              basePath = config.discovery === 'manual' ? config.basePath : null;
              send(msg);
            }
          });
      }, heartRate);
    };

    const processMessage = msg => {
      msg = Object.assign({}, msg);
      let msgType = msg.type;

      // Collect mDNS and unicast DNS browse details, process MSG queue if one exists
      // If mDNS goes away, set basePath back to null, rebuild the queue

      if (!msgType.startsWith('HTTP INIT') || msg.api !== 'nodes') {
        return;
      }

      if (basePath === null) {
        this.warn(`${msgType} request with no base path configured. Queueing.`);
        return msgQueue.push(msg);
      }

      if (!basePath.endsWith('/')) basePath += '/';
      let fullPath = msg.url.replace(/:registration/, basePath);

      if (msgType === 'HTTP INIT POST') {
        request({
          method: 'POST',
          url: fullPath,
          body: msg.payload,
          json: true,
          resolveWithFullResponse: true
        }).then(res => {
          if (msg.update && res.statusCode === 201) { // Updating and is missing
            this.warn(`Sent an update to ${msg.url} and received a created response. Garbage collected?`);
            if (msg.payload.type === 'node') {
              let warnMsg = {
                type: 'NODE UNEXP CREATE',
                payload: msg.url
              };
              return this.send(warnMsg);
            }
          }
          if (!msg.update && res.statusCode === 200) { // Creating but exists
            this.warn(`Sent a resource create message to ${msg.url} and received an update response.`);
            let cycleMsg = {
              type: 'NODE CYCLE REQ',
              payload: msg.url
            };
            return this.send(cycleMsg);
          }
          let replyMsg = {
            type: `HTTP REPLY ${res.statusCode}`,
            payload: res.body
          };
          if (msg.payload.type === 'node') {
            startBeat(`${basePath}/x-nmos/registration/${config.nmosVersion}` +
              `/health/nodes/${msg.payload.data.id}`, this.send);
          }
          return this.send(replyMsg);
        }).catch(e => {
          this.warn(`Failure of HTTP POST request: ${e}`);
          if (e.name === 'StatusCodeError') {
            let failMsg = {
              type: `HTTP REPLY ${e.statusCode}`,
              payload: {
                code: e.statusCode,
                error: `Status code error failure of HTTP request on POST to registration service: ${e}`,
                debug: fullPath
              }
            };
            return this.send(failMsg);
          }
          let replyMsg = {
            type: 'HTTP FAIL',
            payload: {
              error: `Serious failure of HTTP request on POST to registration service: ${e}`,
              debug: fullPath
            }
          };
          return this.send(replyMsg);
        });
        return;
      }

      if (msgType === 'HTTP INIT DELETE') {
        request({
          method: 'DELETE',
          url: fullPath,
          resolveWithFullResponse: true
        }).then(res => {
          let replyMsg = {
            type: `HTTP REPLY ${res.statusCode}`,
            payload: res.body
          };
          if (msg.payload.type === 'node') {
            clearInterval(heartBeat);
            heartBeat = null;
          }
          return this.send(replyMsg);
        }).catch(e => {
          this.warn(`Failure of HTTP DELETE request: ${e}`);
          if (e.name === 'StatusCodeError') {
            let failMsg = {
              type: `HTTP REPLY ${e.statusCode}`,
              payload: {
                code: e.statusCode,
                error: `Status code error failure of HTTP request on DELETE to registration service: ${e}`,
                debug: fullPath
              }
            };
            return this.send(failMsg);
          }
          let replyMsg = {
            type: 'HTTP FAIL',
            payload: {
              error: `Serious failure of HTTP request on DELETE to registration service: ${e}`,
              debug: fullPath
            }
          };
          return this.send(replyMsg);
        });
      }
    };

    this.on('input', processMessage);

    this.on('close', () => {
      clearTimeout(heartBeat);
      heartBeat = null;
    });
  }
  RED.nodes.registerType('node-requester', NodeRequester);
};
