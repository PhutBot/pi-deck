const WebSocket = require('websocket').client;
const Observable = require('./Observable')
const ScenesService = require('./service/ScenesService');

module.exports = class SlobsClient {
    constructor(address, port) {
        this._address = address;
        this._port = port;
        this._connection = null;
        this._id = 0;
        this._callbacks = {};
        this._isConnected = false;
        this._isAuthenticated = false;

        this._scenesService = null;
    }

    get connected() { return this._isConnected; }
    get authenticated() { return this._isAuthenticated; }

    get ScenesService() { return this._scenesService };

    call(resource, method, args = [], compactMode = false) {
        const self = this;
        if (!this._isConnected)
            return Promise.reject('connection not established');
        if (!this._connection)
            throw Promise.reject('connection not initialized');
        if (!this._isAuthenticated && method !== 'auth')
            throw Promise.reject('connection not authenticated');

        return new Promise((resolve, reject) => {
            this._callbacks[++this._id] = { resolve, reject };

            this._connection.sendUTF(JSON.stringify({
                jsonrpc: 2.0,
                id: this._id,
                method,
                params: {
                    resource,
                    args,
                    compactMode
                }
            }));
        });
    }

    when(resource, method) {
        this._connection.sendUTF(JSON.stringify({
            jsonrpc: 2.0,
            id: this._id,
            method,
            params: {
                resource
            }
        }));

        return this._callbacks[`event.stream.${resource}.${method}`] = new Observable();
        // return {
        //     then: (resolve) => {
        //         this._callbacks[`event.stream.${resource}.${method}`].resolve = resolve;
        //         return { catch: (reject) => { this._callbacks[`event.stream.${resource}.${method}`].reject = reject } }
        //     },
        //     catch: (reject) => { this._callbacks[`event.stream.${resource}.${method}`].reject = reject }
        // };
    }

    unwhen(resource, method) {
        delete this._callbacks[`event.stream.${resource}.${method}`];
        return this.call(`${resource}.${method}`, 'unsubscribe');
    }

    authenticate() {
        const self = this;
        return new Promise((resolve, reject) => {
            if (!self._isAuthenticated) {
                self.call('TcpServerService', 'auth', [process.env['TWITCH_BOT.SLOBS_TOKEN']])
                    .then((response) => {
                        resolve(self._isAuthenticated = response.result);
                        self._scenesService = new ScenesService(self);
                    })
                    .catch((err) => reject(err));
            }
        });
    }

    connect() {
        const self = this;
        if (!!this._connection)
            return Promise.resolve(self);

        return new Promise((resolve, reject) => {
            const client = new WebSocket();

            client.on('connectFailed', (error) => {
                self._connection = null;
                self._isConnected = false;
                self._isAuthenticated = false;
                reject(error);
            });

            client.on('connect', (connection) => {
                self._connection = connection;
                self._isConnected = true;

                connection.on('error', (error) => {
                    console.error("Connection Error: " + error.toString());
                });

                connection.on('close', () => {
                    self._connection = null;
                    self._isConnected = false;
                    self._isAuthenticated = false;
                });

                connection.on('message', (message) => {
                    if (message.type !== 'utf8') {
                        console.warn("Received: '" + message + "'");
                        return;
                    }

                    const json = JSON.parse(message.utf8Data);
                    if (json.id in self._callbacks) {
                        if ('error' in json) {
                            self._callbacks[json.id].reject(json);
                        } else if ('result' in json && !!json.result && typeof json.result === 'object'
                            && '_type' in json.result && json.result._type !== 'HELPER') {
                            console.warn("Received: '" + message.utf8Data + "'");
                            throw new Error("what is this??? 1");
                        } else {
                            self._callbacks[json.id].resolve(json);
                        }

                        delete self._callbacks[json.id];
                        return;
                    }

                    if ('result' in json && typeof json.result === 'object' && '_type' in json.result) {
                        if (json.result._type === 'EVENT') {
                            if (json.result.emitter === 'STREAM') {
                                self._callbacks[`event.stream.${json.result.resourceId}`].triggerEvent(json);
                            } else if (json.result.emitter === 'PROMISE') {
                                if (!json.result.isRejected) {
                                    self._callbacks[`event.promise.${json.result.resourceId}`].resolve(json);
                                } else {
                                    self._callbacks[`event.promise.${json.result.resourceId}`].reject(json);
                                }
                                delete self._callbacks[`event.promise.${json.result.resourceId}`];
                            } else {
                                console.warn("Received: '" + message.utf8Data + "'");
                                throw new Error("what is this??? 2");
                            }

                            return;
                        } else if (json.result._type === 'SUBSCRIPTION') {
                            if (json.result.emitter === 'STREAM') {
                                // ignored
                            } else if (json.result.emitter === 'PROMISE') {
                                self._callbacks[`event.promise.${json.result.resourceId}`]
                                    = self._callbacks[json.id];
                            } else {
                                console.warn("Received: '" + message.utf8Data + "'");
                                throw new Error("what is this??? 3");
                            }

                            return;
                        }
                    }

                    console.warn("Received: '" + message.utf8Data + "'");
                });

                resolve(self);
            });

            client.connect(`ws://${this._address}:${this._port}/api/websocket`);
        });
    }

    disconnect() {
        this._scenesService = null;
        if (!!this._connection) {
            this._connection.close();
            this._connection = null;
        }
    }
};