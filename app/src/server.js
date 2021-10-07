const http = require('http');
const logger = require('npmlog');


class PageNotFoundError extends Error {
    constructor(url, options) {
        super(`page not found [${url.pathname}]`, options);
    }
}
class InternalServerError extends Error {
    constructor(msg, options) {
        super(`internal server error: ${msg}`, options);
    }
}

class Server {
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

        this._handle404 = async ({ err }, req, res) => {
                logger.error('Server', `[ERROR]: 404 - ${err.message || err}`);
                res.writeHead(404);
                res.end('Error 404: page not found');
            };

        this._handle500 = async ({ err }, req, res) => {
                logger.error('Server', `[ERROR]: 500 - ${err.message || err}`);
                res.writeHead(500);
                res.end('Error 500: internal server error');
            };
        
        this._sockets = [];
        this._running = false;
        this._port = port;
        this._hostname = hostname;
        this._server = http.createServer((req, res) => this._baseListener(req, res));

        this._server.on('connection', (socket) => {
                this._sockets.push(socket);
            });
    }

    start() {
        if (this.running) {
            logger.warn('Server', 'server already started');
            return;
        }

        this._server.listen(this.port, this.hostname, () => {
                this._running = true;
                logger.info('Server', `server started @ ${this.address}`);
                this.onStart();
            });
    }

    stop() {
        if (!this.running) {
            logger.warn('Server', 'server already stopped');
            return;
        }

        this._sockets.forEach(socket => socket.destroy());
        this._server.close(() => {
                logger.info('Server', 'server stopped');
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
            logger.error('Server', `[ERROR]: 1 - ${err}`);
        }
        return handler;
    }

    defineHandler({ method, path, handler, force }) {
        path = path.replace(/[\/]+/g, '/');

        if (!method in this._handlers) {
            throw 'unsupported http method';
        } else if (!path in this._handlers[method]) {
            if (!!force)
                logger.warn('Server', `overriding handler ${method} ${path}`);
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
                logger.warn('Server', `overriding handler ${method} ${pattern}`);
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
                        if (err instanceof PageNotFoundError) {
                            this._handle404({ url, body, err }, req, res);
                        } else {
                            this._handle500({ url, body, err }, req, res);
                        }
                    } catch (err2) {
                        logger.error('Server', `[FATAL]: 500 - ${err2}`);
                        process.exit(1);
                    }
                });
        });

        req.on('error', (err) => {
            try {
                logger.error('Server', `[ERROR]: 2 - ${err}`);
                this._handle500({ url, err }, req, res);
            } catch (err2) {
                logger.error('Server', `[FATAL]: 3 - ${err2}`);
                process.exit(1);
            }
        });
    }

    _escapeRegex(text) {
        return text.replace(/[-[\]{}()+?.,\\^$|#\s]/g, '\\$&');
    }

    _patternToRegex(text) {
        return '^' + this._escapeRegex(text).replace(/\*/g, '.*') + '$';
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
    PageNotFoundError,
    InternalServerError,
    Server
};
