const http = require('http');
const net = require('net');
const { createHash } = require("crypto");
const logger = require('npmlog');

const WsCloseCodeMsgs = {
    1000: 'indicates a normal closure, meaning that the purpose for which the connection was established has been fulfilled.',
    1001: 'indicates that an endpoint is "going away", such as a server going down or a browser having navigated away from a page.',
    1002: 'indicates that an endpoint is terminating the connection due to a protocol error.',
    1003: 'indicates that an endpoint is terminating the connection because it has received a type of data it cannot accept (e.g., an endpoint that understands only text data MAY send this if it receives a binary message).',
};

class HttpError extends Error {
    constructor(statusCode, msg, options) {
        super(msg, options);
        this._statusCode = statusCode;
    }

    get statusCode() {
        return this._statusCode;
    }
}

class PageNotFoundError extends HttpError {
    constructor(url, options) {
        super(404, `page not found [${url.pathname}]`, options);
    }
}
class InternalServerError extends HttpError {
    constructor(msg, options) {
        super(500, `internal server error: ${msg}`, options);
    }
}

class BadRequestError extends HttpError {
    constructor(msg, options) {
        super(400, `bad request: ${msg}`, options);
    }
}

class HttpServer {
    constructor(port, hostname = '0.0.0.0') {
        this._handlers = {
                DELETE: {},
                GET: {},
                PATCH: {},
                POST: {},
                PUT: {}
            };
        this._wildHandlers = {
                DELETE: {},
                GET: {},
                PATCH: {},
                POST: {},
                PUT: {}
            };

        this._handleError = async ({ err }, _, res) => {
                const code = err.statusCode || 500;
                const msg = err.message || err;
                logger.error('HttpServer', `[ERROR]: ${code} - ${msg}`);
                res.writeHead(code);
                res.end(msg);
            };

        this._handle404 = async ({ err }, req, res) => {
                logger.error('HttpServer', `[ERROR]: 404 - ${err.message || err}`);
                res.writeHead(404);
                res.end('Error 404: page not found');
            };

        this._handle500 = async ({ err }, req, res) => {
                logger.error('HttpServer', `[ERROR]: 500 - ${err.message || err}`);
                res.writeHead(500);
                res.end('Error 500: internal server error');
            };
        
        this._sockets = [];
        this._running = false;
        this._port = port;
        this._hostname = hostname;
        this._server = http.createServer((req, res) => {
            try {
                this._baseListener(req, res)
            } catch (err) {
                if (err instanceof HttpError) {
                    this._handleError({ err }, req, res);
                } else {
                    this._handle500({ err: 'unkown error' }, req, res);
                    throw err;
                }
            }
        });

        this._server.on('connection', (socket) => {
                this._sockets.push(socket);
            });

        this._server.on('upgrade', (req, socket) => {
                const acceptVal = this._getWebsocketAcceptValue(req.headers['sec-websocket-key']);
                const headers = [
                    'HTTP/1.1 101 Web Socket Protocol Handshake',
                    'Upgrade: websocket',
                    'Connection: Upgrade',
                    `Sec-WebSocket-Accept: ${acceptVal}`,
                    '', ''
                ];
                
                let op = null;
                let runningIdx = 0;
                let len = 0;
                let count = 0;
                let mask = [];
                let msg = null;
                socket.on('data', (buffer) => {
                    let byteIdx = 0;
                    while (byteIdx < buffer.length) {
                        if (len === 0) {
                            let byte = buffer.readUInt8(byteIdx++);
                            const fin = (byte & 0x80) >> 7;
                            const res = (byte & 0x70) >> 4;
                            op = (byte & 0x0F) >> 0;

                            byte = buffer.readUInt8(byteIdx++);
                            const hasMask = (byte & 0x80) >> 7;
                            len = (byte & 0x7F) >> 0;

                            if (len === 126) {
                                len = buffer.readUInt16BE(byteIdx);
                                byteIdx += 2;
                            } else if (len === 127) {
                                len = buffer.readBigUInt64BE(byteIdx);
                                byteIdx += 8;
                            }
                            msg = Buffer.alloc(len);

                            mask = [
                                buffer.readUInt8(byteIdx++),
                                buffer.readUInt8(byteIdx++),
                                buffer.readUInt8(byteIdx++),
                                buffer.readUInt8(byteIdx++),
                            ];
                        }

                        const end = typeof len === 'bigint'
                            ? buffer.length
                            : Math.min(buffer.length, byteIdx + len);

                        buffer.subarray(byteIdx, end).forEach((byte, i) => {
                            msg.writeUInt8(byte ^ mask[runningIdx % 4], i);
                            runningIdx++;
                            byteIdx++;
                        });

                        if (op === 0x1) {
                            // const payload = msg.toString();
                            // msg += payload;
                        } else if (op === 0x8) {
                            const code = msg.readUInt16BE();
                            console.log(WsCloseCodeMsgs[code]);
                        } else {
                            console.log(op);
                        }

                        count += buffer.length;
                        if (count >= len) {
                            console.log(msg.toString());
                            socket.write(this.createWsMsg(msg));
                            len = 0;
                            mask = [];
                            runningIdx = 0;
                            op = null;
                            msg = null;
                        }
                    }
                }).on('end', () => {
                    console.log('end');
                });
                
                const out = headers.join('\r\n');
                socket.write(out);
            });
    }

    createWsMsg(msg) {
        const fin = 1;
        const res = 0;
        const op = 0x1;
        let byte1 = ((fin & 0x1) << 7) | ((res & 0x7) << 4) | (op & 0xF);
        
        const hasMask = 0;
        let lenEx = 0;
        let lenExSize = 0;
        let len = msg.length;
        if (len >= 0x7E && len <= 0xFFFF) {
            lenEx = len;
            lenExSize = 2;
            len = 126;
        } else if (len > 0xFFFF) {
            lenEx = len;
            lenExSize = 8;
            len = 127;
        }
        let byte2 = ((hasMask & 0x1) << 7) | (len & 0x7F);
        
        const buffer = Buffer.alloc(2 + lenExSize + msg.length);
        buffer.writeUInt8(byte1, 0);
        buffer.writeUInt8(byte2, 1);

        if (lenExSize === 2) {
            buffer.writeUInt16BE(lenEx, 2);
        } else if (lenExSize === 8) {
            buffer.writeBigUInt64BE(lenEx, 2);
        }

        buffer.write(msg.toString(), 2 + lenEx, 'utf-8');
        return buffer;
    }

    start() {
        if (this.running) {
            logger.warn('HttpServer', 'server already started');
            return;
        }

        this._server.listen(this.port, this.hostname, () => {
                this._running = true;
                logger.info('HttpServer', `server started @ ${this.address}`);
                this.onStart();
            });
    }

    stop() {
        if (!this.running) {
            logger.warn('HttpServer', 'server already stopped');
            return;
        }

        this._sockets.forEach(socket => socket.destroy());
        this._server.close(() => {
                logger.info('HttpServer', 'server stopped');
                this.onStop();
                this._running = false;
            });
    }

    getHandler(method, path) {
        let handler = this._handle404;
        try {
            if (method in this._handlers) {
                const methodHandlers = this._handlers[method];
                if (path in methodHandlers) {
                    handler = methodHandlers[path];
                }
            }
            
            if (handler === this._handle404 && method in this._wildHandlers) {
                const methodHandlers = this._wildHandlers[method];
                const patterns = Object.keys(methodHandlers).filter(pattern => {
                    const re = new RegExp(pattern);
                    return re.test(path);
                });
                if (patterns.length > 0) {
                    handler = methodHandlers[patterns[0]];
                }
            }
        } catch (err) {
            handler = this._handle500;
            logger.error('HttpServer', `[ERROR]: 1 - ${err}`);
        }
        return handler;
    }

    defineHandler({ method, path, handler, force }) {
        path = path.replace(/[\/]+/g, '/');

        if (!method in this._handlers) {
            throw 'unsupported http method';
        } else if (!path in this._handlers[method]) {
            if (!!force)
                logger.warn('HttpServer', `overriding handler ${method} ${path}`);
            else
                throw `handler already exists: ${method} ${path}`;
        }

        this._handlers[method][path] = handler;
    }

    removeHandler({ method, path }) {
        if (method in this._handlers) {
            delete this._handlers[method][path];
        }
    }

    defineWildHandler({ method, pattern, handler, force }) {
        pattern = this._patternToRegex(pattern);
        
        if (!method in this._wildHandlers) {
            throw 'unsupported http method';
        } else if (!pattern in this._wildHandlers[method]) {
            if (!!force)
                logger.warn('HttpServer', `overriding handler ${method} ${pattern}`);
            else
                throw `handler already exists: ${method} ${pattern}`;
        }
        this._wildHandlers[method][pattern] = handler;
    }

    removeHandler({ method, pattern }) {
        if (method in this._wildHandlers) {
            delete this._wildHandlers[method][pattern];
        }
    }

    _baseListener(req, res) {
        let proto =  'http';

        if (proto === 'ws' || proto === 'wss') {
            this._doWs(req, res);
        } else {
            this._doHttp(req, res);
        }
    }
    
    _doHttp(req, res) {
        const url = new URL(req.url, `http://${req.headers.host}`);
        let handleError = null;
        const handle = this.getHandler(req.method, url.pathname);
        if (handle === this._handle404) {
            handleError = `page not found: [${url.pathname}]`;
        } else if (handle === this._handle500) {
            handleError = 'internal server error';
        }

        let chunks = [];
        req.on('data', (chunk) => {
            chunks.push(chunk);
        }).on('end', () => {
            let body = Buffer.concat(chunks).toString();

            if (req.headers['content-type'] === 'application/json') {
                body = JSON.parse(body);
            }

            handle({ url, body, err: handleError }, req, res)
                .catch(err => {
                    try {
                        if (err instanceof HttpError) {
                            this._handleError({ url, body, err }, req, res);
                        } else {
                            this._handle500({ url, body, err }, req, res);
                        }
                    } catch (err2) {
                        logger.error('HttpServer', `[FATAL]: 500 - ${err2}`);
                        process.exit(1);
                    }
                });
        });

        req.on('error', (err) => {
            try {
                logger.error('HttpServer', `[ERROR]: 2 - ${err}`);
                this._handle500({ url, err }, req, res);
            } catch (err2) {
                logger.error('HttpServer', `[FATAL]: 3 - ${err2}`);
                process.exit(1);
            }
        });
    }

    _doWs(req, res) {
        this._handle500({ err: 'websocket not implemented' }, req, res);
    }

    _escapeRegex(text) {
        return text.replace(/[-[\]{}()+?.,\\^$|#\s]/g, '\\$&');
    }

    _patternToRegex(text) {
        return '^' + this._escapeRegex(text).replace(/\*/g, '.*') + '$';
    }

    _getWebsocketAcceptValue(key) {
        return createHash("sha1")
            .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
            .digest("base64");
    }

    get running() {
        return this._running;
    }

    get port() {
        return this._port;
    }

    get hostname() {
        return this._hostname;
    }

    get address() {
        const proto = 'http';
        const hostname = this.hostname === '0.0.0.0'
            ? 'localhost' : this.hostname;
        const port = this.port !== 80 && this.port !== 443
            ? `:${this.port}` : '';
        return `${proto}://${hostname}${port}`;
    }

    get onStart() {
        return !!this._onStart ? this._onStart : () => {};
    }

    set onStart(func) {
        this._onStart = func;
    }

    get onStop() {
        return !!this._onStop ? this._onStop : () => {};
    }

    set onStop(func) {
        this._onStop = func;
    }
}

module.exports = {
    HttpError,
    PageNotFoundError,
    InternalServerError,
    BadRequestError,
    HttpServer
};
