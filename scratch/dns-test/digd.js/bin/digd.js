#!/usr/bin/env node

'use strict';

var cli = require('cli');
var pkg = require('../package.json');
var dig = require('dig.js/dns-request');
var dnsjs = require('dns-suite');
var common = require('dig.js/common');
var defaultNameservers = require('dns').getServers();
var hexdump;

var NOERROR = 0;
var SERVFAIL = 2;
//var NXDOMAIN = 3;
var REFUSED = 5;

cli.parse({
//  'b': [ false, 'set source IP address (defaults to 0.0.0.0)', 'string' ]
  'class': [ 'c', 'class (defaults to IN)', 'string', 'IN' ]
, 'debug': [ false, 'more verbose output', 'boolean', false ]
//, 'insecure': [ false, 'turn off RaNDOm cAPS required for securing queries']
//, 'ipv4': [ '4', 'use ipv4 exclusively (defaults to false)', 'boolean', false ]
//, 'ipv6': [ '6', 'use ipv6 exclusively (defaults to false)', 'boolean', false ]
//, 'json': [ false, 'output results as json', 'string' ]
//, 'lint': [ false, 'attack (in the metaphorical sense) a nameserver with all sorts of queries to test for correct responses', 'string', false ]
, 'mdns': [ false, "Alias for setting defaults to -p 5353 @224.0.0.251 -t PTR -q _services._dns-sd._udp.local and waiting for multiple responses", 'boolean', false ]
, 'timeout': [ false, "How long, in milliseconds, to wait for a response. Alias of +time=", 'int', false ]
, 'output': [ 'o', 'output prefix to use for writing query and response(s) to disk', 'file' ]
, 'input': [ false, 'input file to use for authoritative responses', 'file' ]
, 'address': [ false, 'ip address(es) to listen on (defaults to 0.0.0.0,::0)', 'string' ]
, 'port': [ 'p', 'port (defaults to 53 for dns and 5353 for mdns)', 'int' ]
, 'nameserver': [ false, 'the nameserver(s) to use for recursive lookups (defaults to ' + defaultNameservers.join(',') + ')', 'string' ]
//, 'serve': [ 's', 'path to json file with array of responses to issue for given queries', 'string' ]
//, 'type': [ 't', 'type (defaults to ANY for dns and PTR for mdns)', 'string' ]
//, 'query': [ 'q', 'a superfluous explicit option to set the query as a command line flag' ]
});

cli.main(function (args, cli) {
  args.forEach(function (arg) {
    if (arg === '+norecurse') {
      if (cli.norecurse) {
        console.error("'+norecurse' was specified more than once");
        process.exit(1);
        return;
      }
      cli.norecurse = true;
      return;
    }
    if (arg === '+notcp') {
      if (cli.notcp) {
        console.error("'+notcp' was specified more than once");
        process.exit(1);
        return;
      }
      cli.notcp = true;
      return;
    }
    if (arg === '+tcp') {
      if (cli.tcp) {
        console.error("'+tcp' was specified more than once");
        process.exit(1);
        return;
      }
      cli.tcp = true;
      return;
    }
  });

  if (!cli.tcp) {
    if (!cli.notcp) {
      console.info("[WARNING] Set '+notcp' to disable tcp connections. The default behavior changes to +tcp in v1.3");
    }
  }

  if (cli.mdns) {
    if (!cli.type) {
      cli.type = cli.t = 'PTR';
    }
    if (!cli.port) {
      cli.port = cli.p = 5353;
    }
    if (!cli.nameserver) {
      cli.nameserver = '224.0.0.251';
    }
    if (!cli.query) {
      cli.query = '_services._dns-sd._udp.local';
    }
    if (!('timeout' in cli)) {
      cli.timeout = 3000;
    }
  } else {
    if (!cli.port) {
      cli.port = cli.p = 53;
    }
  }

  var dnsd = {};
  dnsd.onMessage = function (nb, cb) {
    var byteOffset = nb._dnsByteOffset || nb.byteOffset;
    var queryAb = nb.buffer.slice(byteOffset, byteOffset + nb.byteLength);
    var query;
    var count;

    try {
      query = dnsjs.DNSPacket.parse(queryAb);
    } catch(e) {
      // TODO log bad queries (?)
      console.error("Could not parse DNS query, ignoring.");
      console.error(e);
      try {
        hexdump = require('hexdump.js').hexdump;
        console.error(hexdump(queryAb));
        console.error('');
      } catch(e) {
        // ignore
      }
      return;
    }

    if (cli.debug) {
      console.log('');
      console.log('DNS Question:');
      console.log('');
      console.log(query);
      console.log('');
      try {
        hexdump = require('hexdump.js').hexdump;
        console.log(hexdump(queryAb));
        console.log('');
      } catch(e) {
        // ignore
      }
    }

    dig.logQuestion(query);
    /*
    console.log(';; Got question:');
    console.log(';; ->>HEADER<<-');
    console.log(JSON.stringify(query.header));
    console.log('');
    console.log(';; QUESTION SECTION:');
    query.question.forEach(function (q) {
      console.log(';' + q.name + '.', ' ', q.className, q.typeName);
    });
    */

    function print(q) {
      var printer = common.printers[q.typeName] || common.printers.ANY;
      printer(q);
    }
    if (query.answer.length) {
      console.error('[ERROR] Query contains an answer section:');
      console.log(';; ANSWER SECTION:');
      query.answer.forEach(print);
    }
    if (query.authority.length) {
      console.log('');
      console.error('[ERROR] Query contains an authority section:');
      console.log(';; AUTHORITY SECTION:');
      query.authority.forEach(print);
    }
    if (query.additional.length) {
      console.log('');
      console.error('[ERROR] Query contains an additional section:');
      console.log(';; ADDITIONAL SECTION:');
      query.additional.forEach(print);
    }
    console.log('');
    console.log(';; MSG SIZE  rcvd: ' + nb.byteLength);
    console.log('');

    if (cli.output) {
      console.log('');
      common.writeQuery(cli, query, queryAb);
      //common.writeResponse(opts, query, nb, packet);
    }

    function sendEmptyResponse(query, rcode) {
      // rcode
      // 0 SUCCESS  // manages this domain and found a record
      // 2 SERVFAIL // could not contact authoritatve nameserver (no recursion, etc)
      // 3 NXDOMAIN // manages this domain, but doesn't have a record
      // 5 REFUSED  // doesn't manage this domain
      var newAb;
      var emptyResp = {
        header: {
          id: query.header.id // require('crypto').randomBytes(2).readUInt16BE(0)
        , qr: 1
        , opcode: 0
        , aa: 0     // TODO it may be authoritative
        , tc: 0
        , rd: query.header.rd
        , ra: cli.norecurse ? 0 : 1 // TODO is this bit dependent on the rd bit?
        , rcode: rcode ? rcode : 0 // no error
        }
      , question: []
      , answer: []
      , authority: []
      , additional: []
      };
      query.question.forEach(function (q) {
        emptyResp.question.push({
          name: q.name
        , type: q.type
        , typeName: q.typeName
        , class: q.class
        , className: q.className
        });
      });

      try {
        newAb = dnsjs.DNSPacket.write(emptyResp);
      } catch(e) {
        console.error("Could not write empty DNS response");
        console.error(e);
        console.error(emptyResp);
        cb(e, null, '[DEV] response sent (empty)');
        return;
      }

      cb(null, newAb, '[DEV] response sent (empty)');
    }

    function sendResponse(newPacket) {
      var newAb;

      try {
        newAb = dnsjs.DNSPacket.write(newPacket);
      } catch(e) {
        console.error("Could not write DNS response from local");
        console.error(e);
        console.error(newPacket);
        cb(e, null, '[DEV] response sent (local query)');
        return;
      }

      cb(null, newAb, '[DEV] response sent (local query)');
    }

    function recurse() {
      if (!query.header.rd) {
        console.log("[DEV] no recursion desired. Sending empty response.]");
        sendEmptyResponse(query, SERVFAIL);
        return;
      }

      if (cli.norecurse) {
        console.log("[DEV] recursion forbidden. Sending empty response.]");
        sendEmptyResponse(query, REFUSED);
        return;
      }

      // TODO newQuery

      var newResponse = {
        header: {
          id: query.header.id // require('crypto').randomBytes(2).readUInt16BE(0)
        , qr: 0
        , opcode: 0
        , aa: 0 // query.header.aa ? 1 : 0 // NA? not sure what this would do
        , tc: 0     // NA
        , rd: 1
        , ra: 0     // NA
        , rcode: SERVFAIL  // NA
        }
      , question: []
      , answer: []
      , authority: []
      , additional: []
      };
      query.question.forEach(function (q) {
        newResponse.question.push({
          name: q.name
        , type: q.type
        , typeName: q.typeName
        , class: q.class
        , className: q.className
        });

        function updateCount() {
          var newAb;
          count -= 1;

          if (count <= 0) {
            try {
              newAb = dnsjs.DNSPacket.write(newResponse);
            } catch(e) {
              console.error("Could not write DNS response");
              console.error(newResponse);
              cb(e, null, '[DEV] response sent');
              return;
            }

            cb(null, newAb, '[DEV] response sent');
          }
        }

        var opts = {
          onError: function () {
            updateCount();
          }
        , onMessage: function (packet) {
            // yay! recursion was available after all!
            newResponse.header.qr = 1;
            newResponse.header.ra = 1;
            newResponse.header.rcode = NOERROR;

            (packet.answer||[]).forEach(function (a) {
              // TODO copy each relevant property
              console.log('ans', JSON.stringify(a, null, 2));
              newResponse.answer.push(a);
            });
            (packet.authority||[]).forEach(function (a) {
              // TODO copy each relevant property
              console.log('auth', JSON.stringify(a, null, 2));
              newResponse.authority.push(a);
            });
            (packet.additional||[]).forEach(function (a) {
              // TODO copy each relevant property
              console.log('add', JSON.stringify(a, null, 2));
              newResponse.additional.push(a);
            });

            updateCount();

          }
        , onListening: function () {}
        , onSent: function (/*res*/) {
            /*
            if (cli.debug) {
              console.log('');
              console.log('request sent to', res.nameserver);
            }
            */
            //console.log('[DEV] query sent (recurse)', rinfo.port, rinfo.address);
            //dnsd.onSent('[DEV] query sent (recurse)');
          }
        , onTimeout: function (res) {
            console.log(";; [" + q.name + "] connection timed out; no servers could be reached");
            console.log(";; [timed out after " + res.timeout + "ms and 1 tries]");

            updateCount();
          }
        , onClose: function () {
            console.log('');
          }
        , mdns: cli.mdns
        , nameserver: cli.chosenNameserver
        , port: cli.resolverPort || 53 // TOODO accept resolverPort
        , timeout: cli.timeout
        };

        //dig.resolve(queryAb, opts);
        dig.resolveJson(query, opts);

        console.log(';' + q.name + '.', ' ', q.className, q.typeName);
      });
    }

    count = query.question.length;
    if (count <= 0) {
      sendEmptyResponse(query);
      return;
    }

    // TODO get local answer first, if available
    var path = require('path');
    if (!cli.input) {
      console.warn('[WARN] no db path given, must recurse if enabled');
      recurse();
      return;
    }

    function respondWithResults(err, resp) {

      if (err) { console.log('[DEV] answer not found in local db, recursing'); console.error(err); recurse(); return; }

      if (!cli.norecurse && query.header.rd && (REFUSED === resp.header.rcode)) {
        console.log('[DEV] answer not found in local db, recursing');
        recurse();
        return;
      }

      if (SERVFAIL === resp.header.rcode) { console.log('[DEV] local cache miss, recursing'); recurse(); return; }

      // TODO double check does it matter whether rd is set when responding with ra?
      if (!cli.norecurse && query.header.rd) { resp.header.ra = 1; }

      sendResponse(resp);
    }

    var engine;
    try {
      engine = require('../lib/store.json.js').create({ filepath: path.resolve(cli.input) });
    } catch(e) {
      respondWithResults(e);
      return;
    }
    require('../lib/digd.js').query(engine, query, respondWithResults);
  };

  cli.defaultNameservers = defaultNameservers;
  require('../lib/udpd.js').create(cli, dnsd).on('listening', function () {
    cli.chosenNameserver = cli.nameserver;
    var index;

    if (!cli.chosenNameserver) {
      index = require('crypto').randomBytes(2).readUInt16BE(0) % cli.defaultNameservers.length;
      cli.chosenNameserver = cli.defaultNameservers[index];
      if (cli.debug) {
        console.log('index, defaultNameservers', index, cli.defaultNameservers);
      }
    }
  });
  if (cli.tcp /* TODO v1.3 !cli.notcp */) {
    require('../lib/tcpd.js').create(cli, dnsd);
  }

  console.log('');
  if (!cli.nocmd) {
    console.log('; <<>> digd.js v' + pkg.version + ' <<>> ' + process.argv.slice(2).join(' '));
    console.log(';; global options: +cmd');
  }

});
