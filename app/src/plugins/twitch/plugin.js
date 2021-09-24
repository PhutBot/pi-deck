const Env = require('../../helper/Env');
const BasePlugin = require('../base/plugin');
const TwitchOAuth2 = require('./api/TwitchOAuth2');
const Bot = require('./Bot.js');

module.exports = class TwitchPlugin extends BasePlugin {
    constructor() {
        super({
                name: 'twitch',
                version: '0.0.1',
                description: 'The twitch plugin for the PiDeck.',
                author: 'Caleb French'
            });

        this._auth = {
            app: {
                token: null
            },
            chat: {
                login: Env.get('TWITCH_BOT.CHAT.LOGIN'),
                token: null
            },
            channel: {
                login: Env.get('TWITCH_BOT.CHANNEL.LOGIN'),
                token: null
            }
        };
    }

    async init() {
        this._authApi = new TwitchOAuth2();

        this._auth.app.token = await this._authApi.generateAppToken('TWITCH_BOT.APP');
        this._auth.chat.token = await this._authApi.generateUserAccessToken(
            'TWITCH_BOT.CHAT', `${this.serverAddress}${this.baseUri}/authenticated?name=TWITCH_BOT.CHAT`);
        this._auth.channel.token = await this._authApi.generateUserAccessToken(
            'TWITCH_BOT.CHANNEL', `${this.serverAddress}${this.baseUri}/authenticated?name=TWITCH_BOT.CHANNEL`);
        // this.env.save();
        
        this._bot = new Bot(this._auth);
        this._bot.start();
    }

    async cleanup() {
        await this._bot.stop();
    }

    get endpoints() {
        return [
            {
                method: 'GET',
                path: '/authorize',
                handler: async ({}, _, res) => {
                        res.setHeader('Location', this._authApi.authCodeUrl);
                        res.writeHead(301);
                        res.end();
                    }
            }, {
                method: 'GET',
                path: '/authenticated',
                handler: async ({ url }, _, res) => {
                        let vars = this._authApi.varNames;
                        if (url.searchParams.has('name')) {
                            vars = TwitchOAuth2._scopeVars(url.searchParams.get('name'), vars);
                        }
                        
                        if (url.searchParams.has('code')) {
                            Env.set(vars.CODE, url.searchParams.get('code'));
                            res.writeHead(200);
                            res.end('Successfully authenticated via twitch');
                        } else {
                            res.writeHead(403);
                            res.end('Failed to authenticate via twitch');
                        }
                    }
            }
        ];
    }
};
