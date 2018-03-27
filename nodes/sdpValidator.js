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

const { getSDP, checkRFC4566, checkST2110 } = require('sdpoker');

module.exports = function (RED) {
  function SDPValidator (config) {
    RED.nodes.createNode(this, config);

    this.on('input', msg => {
      if (msg.type !== 'store create success' && msg.type === 'store update success') {
        return; // Looking for updated senders
      }
      if (msg.req.params.resource !== 'sender') {
        return; // Can only validate senders
      }
      if (!msg.payload.manifest_href) {
        let errMsg = {
          type: 'SDP validation error',
          payload: {
            code: 404,
            error: `Sender obect with ID ''${msg.payload.id}' is missing manifest_href property so SDP cannot be validated.`,
            debug: msg.payload
          }
        };
        return this.send(errMsg);
      }
      getSDP(msg.payload.manifest_href, true)
        .then(sdp => {
          let rfcErrors = checkRFC4566(sdp, config);
          let st2110Errors = checkST2110(sdp, config);
          let errors = rfcErrors.concat(st2110Errors);
          if (errors.length === 0) {
            return this.send({
              type: 'SDP validation success',
              manifest_href: msg.payload.manifest_href,
              payload: sdp
            });
          } else {
            let formattedErrors = `Found ${errors.length} error(s) in SDP file:\n`;
            for ( let c in errors ) {
              formattedErrors += `${+c + 1}: ${errors[c].message}\n`;
            }
            return this.send({
              type: 'SDP validation error',
              payload: {
                code: 400,
                error: formattedErrors,
                debug: sdp
              }
            });
          }
        })
        .catch(e => {
          let errMsg = {
            type: 'SDP validation error',
            payload: {
              code: 400,
              error: e.message,
              debug: msg.payload.manifest_href
            }
          };
          return this.send(errMsg);
        });
    });
  }
  RED.nodes.registerType('sdp-validator', SDPValidator);
};
