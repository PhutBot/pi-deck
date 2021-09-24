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

class SimpleServer {
    constructor(settings = {}) {
        this._settings = Object.assign({
                hostname: '0.0.0.0',
                port: 8080
            }, settings);

        this.handler404 = (url, req, res) => {
                res.writeHead(404);
                res.end('Error 404: Page not found');
            };

        this.handler500 = (url, req, res) => {
                res.writeHead(500);
                res.end('Error 500: Internal server error');
            };

        this._sockets = [];
        this._handlers = {
            'GET': {},
            'POST': {}
        };
        this._server = http.createServer((req, res) => {
                const url = new URL(req.url, `http://${req.headers.host}`);
                
                let handler = this.handler404;
                try {
                    if (req.method in this._handlers) {
                        const method = this._handlers[req.method];
                        if (url.pathname in method) {
                            handler = method[url.pathname];
                        }
                    }
                } catch (err) {
                    handler = this.handler500;
                    console.error(`[ERROR] SimpleServer.SimpleServer: 1 - ${err}`);
                }
                
                try {
                    handler(url, req, res);
                } catch (err) {
                    try {
                        console.error(`[ERROR] SimpleServe.SimpleServer: 2 - ${err}`);
                        this.handler500(url, req, res);
                    } catch (err2) {
                        console.error(`[FATAL] SimpleServe.SimpleServer: 3 - ${err2}`);
                        process.exit(1);
                    }
                }
            });

        this._server.on('connection', (socket) => {
                this._sockets.push(socket);
            });
    }

    get port() {
        return this._settings.port;
    }

    get hostname() {
        return this._settings.hostname;
    }

    get address() {
        return `http://${this.hostname}:${this.port}`;
    }

    defineHandler(method, path, handler) {
        if (!method in this._handlers) {
            throw 'SimpleServer.defineHandler - unsupported method';
        } else if (!path in this._handlers[method]) {
            throw `SimpleServer.defineHandler - method already has endpoint ${path}`;
        }
        this._handlers[method][path] = handler;
    }

    start() {
        this._server.listen(this.port, this.hostname, () => {
                console.log(`[INFO] SimpleServer.start: Server started @ ${this.address}`);
            });
    }

    stop() {
        this._sockets.forEach(socket => {
                socket.destroy();
            });
        this._server.close(() => console.log('[INFO] SimpleServer.stop: Server stopped'));
    }
}

module.exports = {
        request,
        SimpleServer
    };
