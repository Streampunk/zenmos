const http = require('http');

const properties = {
  adminPort : 8000,
};

function adminApiReq(method, path, payload, cb) {
  const req = http.request({
    host: 'localhost',
    port : properties.adminPort,
    path : path,
    method : method,
    headers : {
      'Content-Type' : 'application/json',
      'Content-Length' : payload.length
    }
  }, res => {
    const statusCode = res.statusCode;
    const contentType = res.headers['content-type'];

    if (!((200 === statusCode) || (204 == statusCode))) {
      console.log('Unexpected status from http request:', statusCode);
      return;
    }
    if ((200 === statusCode) && (!/^application\/json/.test(contentType))) {
      console.log('Unexpected content type from http request:', contentType);
      return;
    }

    res.setEncoding('utf8');
    var rawData = '';
    res.on('data', (chunk) => rawData += chunk);
    res.on('end', () => cb(null, (204 === statusCode)?null:JSON.parse(rawData)));
  }).on('error', e => {
    console.log(`problem with admin API '${method}' request to path '${path}': ${e.message}`);
    cb(e);
  });

  req.write(payload);
  req.end();
}

class nodeRedConfig {
  static setActiveFlow = flow => {
    adminApiReq('POST', '/flows', JSON.stringify(flow), err => {
      if (err)
        console.log('NodeRED admin api request failed -', err);
    });
  };

  static getActiveFlow = cb => {
    adminApiReq('GET', '/flows', '', cb);
  };
}

export default nodeRedConfig;
