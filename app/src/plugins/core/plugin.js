const fs = require('fs');
const BasePlugin = require('../base/plugin');
const { PageNotFoundError } = require("../../server");

module.exports = class CorePlugin extends BasePlugin {
    constructor() {
        super({
                name: 'core',
                version: '0.0.1',
                description: 'The core plugin for the PiDeck.',
                author: 'Caleb French'
            });
        this._overlays = {};
        this._enableOverlayCache = false;
    }

    async log({ msg }) {
        this.logger.info('plugin/core', msg);
    }

    get operations() {
        return {
            log: {
                request: {
                    msg: 'string'
                }
            }
        };
    }

    get endpoints() {
        return [
            {
                method: 'GET',
                path: 'health',
                handler: async ({ url, body }, req, res) => {
                        res.writeHead(200);
                        res.end('OK');
                    }
            },
            {
                method: 'GET',
                pattern: 'overlays/*',
                handler: async ({ url }, req, res) => {
                        let file = null;
                        const path = url.pathname.substr('/plugin/core/overlays/'.length);
                        if (this._enableOverlayCache && path in this._overlays) {
                            file = this._overlays[path];
                        } else {
                            try {
                                if (path.includes('.')) {
                                    file = fs.readFileSync(`plugins/core/overlays/${path}`);
                                } else {
                                    file = fs.readFileSync(`plugins/core/overlays/${path}/overlay.html`, 'utf8');
                                }
                                this._overlays[path] = file;
                            } catch (err) {
                                throw new PageNotFoundError(url, { cause: err });
                            }
                        }
                        
                        if (!file) {
                            throw new PageNotFoundError(url);
                        }

                        res.writeHead(200);
                        res.end(file);
                    }
            },
            {
                method: 'GET',
                pattern: 'tools/*',
                handler: async ({ url }, req, res) => {
                        let file = null;
                        const path = url.pathname.substr('/plugin/core/tools/'.length);
                        if (this._enableOverlayCache && path in this._overlays) {
                            file = this._overlays[path];
                        } else {
                            if (path.includes('.')) {
                                file = fs.readFileSync(`plugins/core/tools/${path}`);
                            } else {
                                file = fs.readFileSync(`plugins/core/tools/${path}/tool.html`, 'utf8');
                            }
                            this._overlays[path] = file;
                        }
                        
                        if (!file) {
                            throw new PageNotFoundError(url);
                        } else {
                            res.writeHead(200);
                            res.end(file);
                        }
                    }
            }
        ];
    }
};
