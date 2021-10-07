const https = require('https');
const Env = require('../../helper/Env');
const { Millis, elapsedToString } = require('./helper/Millis');
const { randomString } = require('./helper/Rand');
const TwitchApi = require('./api/TwitchApi');
const TwitchChat = require('./api/TwitchChat');
const TwitchEventSub = require('./api/TwitchEventSub');
const { CmdScopes, ChatCmd } = require('./ChatCmd');  
const { HttpServer } = require('../../server/server');
const { ReadFileLSV, WriteFileLSV } = require('../../helper/File');

//TODO: check on chat rate limits
class Bot {
    constructor(auth) {
        this._auth = auth;
        this._running = false;
        this._api = null;
        this._broadcaster = null;
        this._cmds = {};
        this._followList = [];
        
        this._naughtyListWriteTimeout = null;
        this._naughtyListWriteTimeoutLength = Millis.fromMin(5);
        this._naughtyList = ReadFileLSV('.naughty-list');
        this._blockList = ReadFileLSV('.block-list')
            .map(pattern => new RegExp(pattern));
    }
    
    get running() {
        return this._running;
    }

    async _initEvents() {
        const hostname = Env.get('TWITCH_BOT.NGROK.ADDRESS');

        // pre-populate the follow list
        this._followList = (await this._api.follows(null, this._broadcaster.login))
            .filter(follow => {
                const blocked = this._blockList.some(blockedName => blockedName.test(follow.from_login));
                if (blocked && !this._naughtyList.includes(follow.from_name)) {
                    this._naughtyList.push(follow.from_name);
                }
                return !blocked;
            })
            .map(follow => follow.from_name);
        WriteFileLSV('.naughty-list', this._naughtyList);

        let body = await this._api.getCustomReward(this._broadcaster.id);
        if ('data' in body && Array.isArray(body.data) && body.data.length > 0) {
            body.data.forEach((reward) => {
                if (reward.title === 'Timeout')
                    body = { data: [ reward ] };
            });
        }

        if (!('data' in body && Array.isArray(body.data) && body.data.length > 0))
            body = await this._api.createCustomReward(this._broadcaster.id, 'Timeout', 300, 'I time you out');

        this._ngrokServer = new HttpServer(Env.get('TWITCH_BOT.EVENTS.PORT'));
        this._ngrokServer.start();
        this._twitchEventSub = new TwitchEventSub.EventSubscription(
            this._auth.app.token, hostname, this._ngrokServer);    

        Promise.all(
                Object.keys(await this._twitchEventSub._listSubscription())
                    .map(key => this._twitchEventSub.deleteSubscription(key))
            ).then(() => {
                [
                // {
                //     type: TwitchEventSub.EventSubscriptionType.CHANNEL_GIFT,
                //     name: 'stream_online',
                //     secret: randomString(16),
                //     condition: { "broadcaster_user_id": this._broadcaster.id },
                //     output: async (_) => {
                //         this._followList = [];
                //         (await this._api.follows(null, this._broadcaster.name))
                //             .forEach(follow => {
                //                 this._followList.push(follow.from_name);
                //             });
                //     }
                // },
                {
                    type: TwitchEventSub.EventSubscriptionType.CHANNEL_FOLLOW,
                    name: 'channel_follow',
                    secret: randomString(16),
                    condition: { "broadcaster_user_id": this._broadcaster.id },
                    output: (data) => {
                        if ('event' in data) {
                            const blocked = this._blockList
                                .some(blockedName => blockedName.test(follow.from_login));
                            if (blocked) {
                                if (!this._naughtyList.contains(follow_from)) {
                                    this._naughtyList.push(follow.from_name);
                                    if (!!this._naughtyListWriteTimeout) {
                                        clearTimeout(this._naughtyListWriteTimeout);
                                    }
                                    this._naughtyListWriteTimeout = setTimeout(() => {
                                        WriteFileLSV('.naughty-list', this._naughtyList);
                                    }, this._naughtyListWriteTimeoutLength);
                                }
                            } else if (!this._followList.includes(data.event.user_name)) {
                                this._followList.push(data.event.user_name);
                                this._chat.chat(`${data.event.user_name} thank you for the follow!`);
                            }
                        }
                    }
                },{
                    type: TwitchEventSub.EventSubscriptionType.CHANNEL_SUBSCRIBE,
                    name: 'channel_sub',
                    secret: randomString(16),
                    condition: { "broadcaster_user_id": this._broadcaster.id },
                    output: (data) => {
                        if ('event' in data) {
                            if (!data.event.is_gift) {
                                this._chat.chat(`${data.event.user_name} thank you for the sub!`);
                            }
                        }
                    }
                },{
                    type: TwitchEventSub.EventSubscriptionType.CHANNEL_GIFT,
                    name: 'channel_gift',
                    secret: randomString(16),
                    condition: { "broadcaster_user_id": this._broadcaster.id },
                    output: (data) => {
                        if ('event' in data) {
                            const user_name = !!data.event.is_anonymous ? 'Anonymous' : data.event.user_name;
                            this._chat.chat(`${user_name} thank you for the gifted sub!`);
                        }
                    }
                },{
                    type: TwitchEventSub.EventSubscriptionType.CHANNEL_REDEEM,
                    name: 'channel_redeem_timeout',
                    secret: randomString(16),
                    condition: {
                            "broadcaster_user_id": this._broadcaster.id,
                            "reward_id": body.data[0].id
                        },
                    output: (data) => {
                            if ('event' in data && 'status' in data.event && data.event.status === 'unfulfilled') {
                                this._chat.chat(`.timeout ${data.event.user_name} 180 redemption`);
                                this._api.updateRedemptionStatus(this._broadcaster.id, body.data[0].id, data.event.id, 'CANCELED')
                            }
                        }
                }].forEach(eventSub => {
                    const transport = {
                        method: "webhook",
                        callback: `${hostname}/eventSub/${eventSub.name}`,
                        secret: eventSub.secret
                    };
        
                    this._twitchEventSub.createSubscription(eventSub.name, transport,
                        eventSub.type, eventSub.condition, eventSub.output);
                        
                    console.log(transport.callback);
                });
            });
    }

    async _init() {
        this._cmds = await this.loadCmdsFromSheets('TWITCH_BOT.SHEET_ID', 'TWITCH_BOT.SHEET_NAME');
        
        this._api = new TwitchApi(this._auth.channel.token);
        this._broadcaster = (await this._api.users(this._auth.channel.login))[0];

        await TwitchChat.connect();
        TwitchChat.authenticate('TWITCH_BOT.CHAT.TWITCH_OAUTH2.TOKEN', this._auth.chat.login);
        if (!!this._chat) {
            this._chat.part();
            this._chat.off('cmd');
        }
        
        this._chat = new TwitchChat(this._auth.channel.login, true);
        this._chat.on('cmd', async (user, cmd, msg) => {
                let output = '';
                let sender = user.toLowerCase();
                
                let command = null;
                if (cmd in this._cmds && this._cmds[cmd].enabled) {
                    command = this._cmds[cmd];

                    let hasPermission = command.scope === CmdScopes.VIEWER
                            || this.isBroadcaster(user);
                    if (!hasPermission && command.scope !== CmdScopes.VIP && command.scope !== CmdScopes.BROADCASTER)
                        hasPermission = await this.isModerator(user);
                    if (!hasPermission &&command.scope === CmdScopes.VIP)
                        hasPermission = await this.isVip(user);
                    if (!hasPermission &&command.scope === CmdScopes.SUBSCRIBER)
                        hasPermission = await this.isSubscriber(user);
                    if (!hasPermission && command.scope === CmdScopes.FOLLOWER)
                        hasPermission = await this.isFollower(user);

                    if (hasPermission && Array.isArray(command.outputs) && command.outputs.length > 0) {
                        if (command.outputs.length === 1) {
                            output = command.outputs[0];
                        } else {
                            try {
                                const parts = msg.split(' ', 2);
                                if (parts.length < 1)
                                    throw 'Not enough args';
                                const idx = Number.parseInt(parts[0]);
                                if (isNaN(idx))
                                    throw 'NaN';
                                else
                                    msg = msg.slice(parts[0].length + 1);
                                output = command.outputs[idx];
                            } catch {
                                const idx = Math.floor(Math.random() * command.outputs.length);
                                output = command.outputs[idx];
                            }
                        }
                    }
                } else if (this.isBroadcaster(user) || user === 'phutbot') {
                    switch (cmd) {
                        case 'botkill': this.stop(); break;
                        case 'botreset': await this._init(); break;
                    }
                }

                if (!!output) {
                    const chatMsg = await this.replaceVars(command, output, sender, msg);
                    this._chat.chat(chatMsg);
                }
            });

        this._initEvents();
    }

    async start() {
        if (this._running)
            return;

        try {
            await this._init();
            this._running = true;
        } catch (err) {
            console.error(`[FATAL]: ${err}`);
            if (typeof err === 'object' && 'stack' in err) {
                console.error(err.stack)
            }
            this._running = false;
        }
    }

    async stop() {
        if (this._running) {
            this._chat.part();
            TwitchChat.disconnect();
            if (this._twitchEventSub) {
                await this._twitchEventSub.cleanup();
            }
            this._running = false;
        }
        
        this._ngrokServer.stop();
    }
    
    async isFollower(user) {
        if (user === this._auth.channel.login)
            return true;
        const follows = await this._api.follows(user, this._auth.channel.login, Millis.fromDay(7));
        return follows.length > 0;
    }
    
    async isSubscriber(user) {
        if (user === this._auth.channel.login)
            return true;
        const subscriptions = await this._api.subscriptions(user, this._auth.channel.login, Millis.fromDay(7));
        return subscriptions.length > 0;
    }
    
    async isVip(user) {
        if (user === this._auth.channel.login)
            return true;
        // implement me
        return false;
    }
    
    async isModerator(user) {
        if (user === this._auth.channel.login)
            return true;
        const modList = await this._api.moderators(this._auth.channel.login, Millis.fromSec(10));
        return !!modList.map(mod => mod.user_login).includes(user);
    }
    
    isBroadcaster(user) {
        return (user === this._auth.channel.login);
    }
    
    async broadcasterVars(command) {
        return {
            'broadcaster.name': async () => this._broadcaster.display_name,
            'broadcaster.login': async () => this._broadcaster.login,
            'broadcaster.uptime': async () => {
                    const streams = await this._api.streams(this._broadcaster.login, Millis.fromMin(20));
                    if (streams.length > 0) {
                        const startedAt = Date.parse(streams[0].started_at);
                        const elapsed = Date.now() - startedAt;
                        return elapsedToString(elapsed, { hours: 0, minutes: 1 });
                    } else {
                        throw `could not find stream with broadcaster: ${this._broadcaster.login}`;
                    }
                },
        };
    }
    
    async userVars(command, varName, login) {
        const result = {};
    
        result[`${varName}.name`] = async () => {
                try {
                    const channels = await this._api.channels(login, Millis.fromDay(1));
                    if (channels.length > 0) {
                        return channels[0].broadcaster_name;
                    } else {
                        return login;
                    }
                } catch (err) {
                    console.error(`[WARN] replaceVars: ${err}`);
                    return login;
                }
            };
    
        result[`${varName}.login`] = async () => {
                return login;
            };
    
        result[`${varName}.game`] = async () => {
                try {
                    const cacheTime = Math.max(Millis.fromMin(5), Millis.fromSec(command.userCooldown));
                    const channels = await this._api.channels(login, cacheTime);
                    if (channels.length > 0) {
                        return channels[0].game_name;
                    } else {
                        throw `could not find game for user: ${login}`;
                    }
                } catch (err) {
                    console.error(`[WARN] replaceVars: ${err}`);
                    return 'unknown';
                }
            };
    
        result[`${varName}.followTime`] = async () => {
                const follows = await this._api.follows(login, this._broadcaster.login, Millis.fromHrs(8));
                if (follows.length > 0) {
                    const followedAt = Date.parse(follows[0].followed_at);
                    const elapsed = Date.now() - followedAt;
                    return elapsedToString(elapsed, { years: 0, weeks: 0, days: 1 });
                } else {
                    throw `could not find stream with broadcaster: ${this._broadcaster.login}`;
                }
            };
    
        return result;
    }
    
    async replaceVars(command, output, senderLogin, msg) {
        const args = command.getArgs(msg);
    
        try {
            const chatVars = {
                    'msg': () => msg,
                    ...(await this.broadcasterVars(command)),
                    ...(await this.userVars(command, 'sender', senderLogin)),
                    ...(await this.userVars(command, 'user', args['user'])),
                };
    
            for (const varName in chatVars) {
                if (output.includes(`\${${varName}}`)) {
                    const regex = new RegExp(`\\$\\{${varName}\\}`, 'g');
                    output = output.replace(regex, await chatVars[varName]());
                }
            }
            
            return output;
        } catch (err) {
            console.error(`[WARN] replaceVars: ${err}`);
            return '';
        }
    }
    
    loadCmdsFromSheets(sheetId, sheetName) {
        return new Promise((resolve, reject) => {
            const cmds = {};
    
            https.get(`https://docs.google.com/spreadsheets/d/${Env.get(sheetId)}/gviz/tq?tqx=out:csv&sheet=${Env.get(sheetName)}&gid=0&headers=1`, (res) => {
                if (res.statusCode !== 200) {
                    throw `could not get cmd sheet: ${res.statusCode}`;
                }
                
                let headers = [];
                const rows = [];
                let cols = [];
                let cur = '';
                let inQuotes = false;
                let isHeader = true;
                res.on('data', (chunk) => {
                    const chunkStr = chunk.toString();
                    for (let i = 0; i < chunkStr.length; ++i) {
                        const char = chunkStr.charAt(i);
                        if (char === '\"') {
                            inQuotes = !inQuotes;
                        } else if (inQuotes) {
                            cur += char;
                        } else {
                            if (char === '\n') {
                                if (isHeader) {
                                    headers = cols;
                                    isHeader = false;
                                } else {
                                    rows.push(cols);
                                }
                                cols = [];
                            } else if (char === ',') {
                                cols.push(cur);
                                cur = '';
                            } else {
                                cur += char;
                            }
                        }
                    }
                });
    
                res.on('error', (e) => {
                    reject(`loadCmdsFromSheets - ${e.message}`);
                });
                
                res.on('end', () => {
                    cols.push(cur);
                    rows.push(cols);
                    
                    rows.forEach(cols => {
                        const cmd = new ChatCmd(headers, cols);
                        cmds[cmd.NAME] = cmd;
                    });
                    resolve(cmds);
                });
            });
        });
    }    
}

module.exports = Bot;