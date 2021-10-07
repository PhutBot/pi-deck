const fs = require('fs');
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

        this._htmlFiles = {};
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
        this._auth.channel.token = await this._authApi.generateUserAccessToken(
            'TWITCH_BOT.CHANNEL', `${this.serverAddress}${this.baseUri}/authenticated/channel`);
        this._auth.chat.token = await this._authApi.generateUserAccessToken(
            'TWITCH_BOT.CHAT', `${this.serverAddress}${this.baseUri}/authenticated/chat`);

        this.env.save();        
        this._bot = new Bot(this._auth);
        this._bot.start();
    }

    async cleanup() {
        await this._bot.stop();
        this._auth.app.token.release();
        this._auth.channel.token.release();
        this._auth.chat.token.release();
    }

    get endpoints() {
        return [
            {
                method: 'GET',
                pattern: '*',
                handler: async ({ url }, _, res) => {
                        let file = null;
                        const path = url.pathname.substr('/plugin/twitch/'.length);
                        if (this._enableOverlayCache && path in this._htmlFiles) {
                            file = this._htmlFiles[path];
                        } else {
                            if (path.includes('.')) {
                                file = fs.readFileSync(`plugins/twitch/www/${path}`);
                            } else {
                                file = fs.readFileSync(`plugins/twitch/www/${path}/index.html`, 'utf8');
                            }
                            this._htmlFiles[path] = file;
                        }
                        
                        if (!file) {
                            throw new PageNotFoundError(url);
                        } else {
                            res.writeHead(200);
                            res.end(file);
                        }
                    }
            }, {
                method: 'GET',
                pattern: 'authorize/*',
                handler: async ({ url }, _, res) => {
                        const path = url.pathname.substr('/plugin/twitch/authorize/'.length);
                        const scopeName = `TWITCH_BOT.${path.toUpperCase()}`;
                        
                        res.setHeader('Location', this._authApi.authCodeUrls[scopeName]);
                        res.writeHead(301);
                        res.end();
                    }
            }, {
                method: 'GET',
                pattern: 'authenticated/*',
                handler: async ({ url }, _, res) => {
                        const path = url.pathname.substr('/plugin/twitch/authenticated/'.length);
                        const scopeName = `TWITCH_BOT.${path.toUpperCase()}`;

                        let vars = TwitchOAuth2._scopeVars(scopeName, this._authApi.varNames);
                        if (url.searchParams.has('code')) {
                            Env.set(vars.CODE, url.searchParams.get('code'));
                            res.writeHead(200);
                            res.end(`<html>
                                    Successfully authenticated via twitch
                                    </html>`);
                                    // <script>window.close()</script>
                        } else {
                            res.writeHead(403);
                            res.end('Failed to authenticate via twitch');
                        }
                    }
            }
        ];
    }
};
