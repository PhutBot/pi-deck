const http = require('http');
const https = require('https');

// PhutBot PLEASE remember to be careful when debugging this class on stream
function request({ method, hostname, port, uri, query, headers, body, protocol } = {}) {
    let path = uri;
    hostname = hostname || 'id.twitch.tv';
    port = port === undefined ? 443 : port;
    
    if (!!query) {
        const entries = Object.entries(query);
        if (!path.includes('?') && entries.length > 0) {
            let [key, val] = entries.shift();
            while (!val && entries.length > 0)
                [key, val] = entries.shift();
            if (!!val) {
                path += `?${key}=${val}`;
            }
        }
        entries.forEach(([key, val]) => {
                if (!!val) 
                    path += `&${key}=${val}`;
            });
    }

    return new Promise((resolve, reject) => {
        const proto = protocol === 'HTTP' ? http : https;
        const req = proto.request({
                hostname, port, path, method, headers
            }, res => {
                let data = [];
                res.on('error', (err) => {
                    reject(err);
                }).on('data', chunk => {
                    data.push(chunk);
                }).on('end', () => {
                    data = Buffer.concat(data).toString();
                    resolve({
                        headers: res.headers,
                        body: res.headers['content-type']
                                && res.headers['content-type'].toLowerCase()
                                    .startsWith('application/json')
                            ? JSON.parse(data.toString())
                            : data.toString()
                    });
                });
            });

        req.on('error', err => {
                reject(`request - ${err}`);
            });

        if (!!body) {
            if (typeof body === 'object' || Array.isArray(body))
                req.write(JSON.stringify(body));
            else
                req.write(body);
        }   

        req.end();
    });
}

module.exports = {
        request
    };
