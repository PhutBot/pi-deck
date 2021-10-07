const IrcClient = require('../IrcClient');
const Env = require('../../../helper/Env');
const { Millis } = require('../helper/Millis');

class TwitchChat {
    static login = null;
    static authenticated = false;
    static ircClient = new IrcClient(false);

    static msgQueue = [];
    static msgQueueProcessor = null;
    static msgQueueMaxSize = 3;               // max msg count allowed in queue before dropping msgs (will be multiplied by 5 if the bot is a mod)
    static rateLimitCount = 2;                // twitch rate limit is 20 msgs (will be multiplied by 5 if the bot is a mod)
    static rateLimitTime = Millis.fromSec(3); // every 30 seconds
    static rateLimit = { count: 0, time: TwitchChat.rateLimitTime };

    get rateLimitedCount() {
        return this.isMod ? TwitchChat.rateLimitCount * 5 : TwitchChat.rateLimitCount;
    }

    get msgInterval() {
        return TwitchChat.rateLimitTime / this.rateLimitedCount;
    }

    static async connect(host='irc.chat.twitch.tv', port=6667, timeout=3000) {
        if (!!TwitchChat.ircClient.connected)
            return;
        await TwitchChat.ircClient.connect(host, port, timeout);
    }

    _startMsgQueueProcessor() {
        if (!TwitchChat.msgQueueProcessor) {
            TwitchChat.msgQueueProcessor = setInterval(() => {
                if (TwitchChat.msgQueue.length > 0 && TwitchChat.rateLimit.count < this.rateLimitedCount) {
                    TwitchChat.rateLimit.count += 1;
                    const msg = TwitchChat.msgQueue.shift();
                    this._handleMsg(this.channel, TwitchChat.login, msg);
                    if (!msg.startsWith(this.cmdDel)) {
                        TwitchChat.ircClient.privmsg(this.channel, msg);
                    }
                }

                TwitchChat.rateLimit.time -= this.msgInterval;
                if (TwitchChat.rateLimit.time <= -this.msgInterval) {
                    TwitchChat.rateLimit.count = 0;
                    TwitchChat.rateLimit.time = TwitchChat.rateLimitTime;
                }
            }, this.msgInterval);
        }
    }

    _stopMsgQueueProcessor() {
        if (!!TwitchChat.msgQueueProcessor) {
            clearInterval(TwitchChat.msgQueueProcessor);
        }
    }

    static disconnect() {
        TwitchChat.ircClient.disconnect();
    }

    static authenticate(tokenEnv, login) {
        if (!!TwitchChat.authenticated)
            return;
        TwitchChat.login = login;
        TwitchChat.ircClient.pass(`oauth:${Env.get(tokenEnv)}`);
        TwitchChat.ircClient.nick(login);
        TwitchChat.ircClient.cap(':twitch.tv/membership');
        TwitchChat.ircClient.cap(':twitch.tv/tags');
        TwitchChat.ircClient.cap(':twitch.tv/commands');
        TwitchChat.authenticated = true;
    }

    constructor(channel, isMod=false, cmdDel='!') {
        this._onMsg = (user, msg) => console.log(`<<< ${user}: ${msg}`);
        this._onCmd = (user, cmd, msg) => console.log(`### ${user}: ${cmd}`);

        this.isMod = isMod;
        this.cmdDel = cmdDel;
        this.channel = channel;
        TwitchChat.ircClient.on('msg', (channel, user, msg) => this._handleMsg(channel, user, msg));
        TwitchChat.ircClient.on('disconnect', this._stopMsgQueueProcessor);
        TwitchChat.ircClient.join(this.channel);
        this._startMsgQueueProcessor();
    }

    get connected() {
        return TwitchChat.ircClient.connected;
    }

    on(eventName, handler) {
        switch (eventName) {
            case 'msg': this._onMsg = handler; break;
            case 'cmd': this._onCmd = handler; break;
            default: throw 'TwitchCat - invalid event handler name';
        }
    }

    off(eventName) {
        switch (eventName) {
            case 'msg': this._onMsg = (user, msg) => {}; break;
            case 'cmd': this._onCmd = (user, cmd, msg) => {}; break;
            default: throw 'TwitchCat - invalid event handler name';
        }
    }

    async chat(msg) {
        if (!msg)
            return;
        const msgQueueMaxSize = this.isMod ? TwitchChat.msgQueueMaxSize * 5 : TwitchChat.msgQueueMaxSize;
        if (TwitchChat.msgQueue.length < msgQueueMaxSize - 1) {
            TwitchChat.msgQueue.push(msg);
        } else {
            console.error(`msg queue is full, msg was dropped ${msg}`);
        }
    }

    part() {
        TwitchChat.ircClient.part(this.channel);
    }

    _handleMsg(channel, user, msg) {
        if (channel !== this.channel)
            return;

        if (!!msg) {
            if (msg.startsWith(this.cmdDel)) {
                let end = msg.indexOf(' ');
                end = end < 0 ? undefined : end;
                let cmd = msg.slice(1, end);
                let body = msg.slice(this.cmdDel.length + cmd.length).trim();
                this._onCmd(user, cmd, body);
            } else {
                this._onMsg(user, msg);
            }
        }
    }

    _recvMsg(user, msg) {
        this._onMsg(user, msg);
    }

    _recvCmd(user, cmd, msg) {
        this._onCmd(user, cmd, msg);
    }
}

module.exports = TwitchChat;
