const Env = require('../../helper/Env');
const { InternalServerError } = require('../../server');
const BasePlugin = require('../base/plugin');
const SlobsClient = require('./client/SlobsClient');

module.exports = class SlobsPlugin extends BasePlugin {
    constructor() {
        super({
                name: 'slobs',
                version: '0.0.1',
                description: 'The slobs plugin for the PiDeck.',
                author: 'Caleb French'
            });
        this._client = new SlobsClient(Env.get('SLOBS_CLIENT.ADDRESS'), Env.get('SLOBS_CLIENT.PORT'));
    }

    getSceneNames() {
        return this._client.ScenesService.getSceneNames();
    }

    async makeSceneActive({ name }) {
        const scene = await this._client.ScenesService.getSceneByName(name);
        return this._client.ScenesService.makeSceneActive(scene.id);
    }

    async init() {
        await this.activate();
    }

    async cleanup() {
        await this._client.disconnect();
    }

    async activate() {
        if (!this._client.connected)
            await this._client.connect();
        if (!this._client.authenticated)
            await this._client.authenticate();
    }

    get types() {
        return {
            baseResponse: {
                jsonrpc: 'number',
                id: 'number',
                result: 'array'
            }
        }
    }

    get operations() {
        return {
            getSceneNames: {
                response: {
                    ...this.types.baseResponse,
                    result: 'array<string>'
                }
            },
            makeSceneActive: {
                request: {
                    name: 'string'
                },
                response: {
                    ...this.types.baseResponse,
                    result: 'array<string>'
                }
            }
        };
    }

    get endpoints() {
        return [
            {
                method: 'PUT',
                path: '/scene',
                handler: async ({ body }, req, res) => {
                        let response = null;

                        try {
                            const scene = await this._client.ScenesService.getSceneByName(body.name);
                            response = await this._client.ScenesService.makeSceneActive(scene.id);
                        } catch (err) {
                            throw new InternalServerError('unable to set scene',  { cause: err });
                        }
                            
                        if (!response || !response.result) {
                            throw new InternalServerError('unable to set scene');
                        }
                        
                        res.writeHead(200);
                        res.end('OK');
                    }
            },
            {
                method: 'GET',
                path: '/scene',
                handler: async ({ body }, req, res) => {
                        const response = await this._client.ScenesService.activeScene();
                        res.writeHead(200);
                        res.end(response.result.name);
                    }
            },
            {
                method: 'GET',
                path: '/scenes',
                handler: async ({ body }, req, res) => {
                        const response = await this._client.ScenesService.getSceneNames();
                        res.writeHead(200);
                        res.end(JSON.stringify(response.result));
                    }
            }
        ];
    }
};
