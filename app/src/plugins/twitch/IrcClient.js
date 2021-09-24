const net = require('net');

class IrcClient {
    constructor(verbose=false) {
        this._onMsg = [];
        this._onDisconnect = [];

        this.verbose = verbose;
        this.connected = false;
        this.channels = [];
        this.identity = '';
    }

    on(eventName, handler) {
        switch (eventName) {
            case 'msg': this._onMsg.push(handler); break;
            case 'disconnect': this._onDisconnect.push(handler); break;
            default: throw 'IrcClient - invalid event handler name';
        }
    }

    parse(tags, prefix, cmd, args) {
        switch(cmd) {
            case 'PRIVMSG': return {
                    tags, prefix, cmd,
                    channel: args.shift().slice(1),
                    user: prefix.slice(1, prefix.indexOf('!')),
                    msg: args.join(' ').slice(1)
                };
            case 'WHISPER': return {
                    tags, prefix, cmd,
                    sender: args.shift(),
                    user: prefix.slice(1, prefix.indexOf('!')),
                    msg: args.join(' ').slice(1)
                };
            case 'NOTICE': return {
                    tags, prefix, cmd,
                    msg: args.join(' ').slice(1)
                };
            case 'PING': return {
                    tags, prefix, cmd,
                    server: args.join(' ').slice(1)
                };
            default: return {
                    tags, prefix, cmd, args
                };
        }
    }

    connect(host, port, timeout=-1) {
        if (!!this.client) {
            throw 'IrcClient - already have a connection';
        }

        return new Promise((resolve, reject) => {
            let connectTimeout;
            if (timeout > 0) {
                connectTimeout = setTimeout(() => {
                    reject('IrcClient.connect - connection timeout')
                }, timeout);
            }

            this.client = net.connect({ port, host }, () => {
                console.log(`[INFO] IrcClient.connect:  connected to server @ ${host}:${port}`);
                if (timeout > 0)
                    clearTimeout(connectTimeout);
                this.connected = true;
                resolve();
            });
            
            this.client.on('data', (data) => {
                const msgs = data.toString().split('\r\n');
                msgs.pop();
                msgs.forEach(msg => {
                    const parts = msg.split(' ');

                    const hasTags = parts[0].startsWith('@');
                    const tags = hasTags ? parts.shift() : null;

                    const hasPrefix = parts[0].startsWith(':');
                    const prefix = hasPrefix ? parts.shift() : null;

                    const command = parts.shift();
                    
                    const body = this.parse(tags, prefix, command, parts);
                    if (body.cmd === 'PRIVMSG') {
                        this._onMsg.forEach(func => func(body.channel, body.user, body.msg));
                    } else if (body.cmd === 'NOTICE') {
                        console.log(`< ${body.prefix}: ${body.msg}`);
                    } else if (body.cmd === 'WHISPER') {
                        console.log(`< ~${body.sender}#${body.user}: ${body.msg}`);
                    } else {
                        if (body.cmd === 'PING')
                            this.pong(body.server)
                        else if (this.verbose)
                            console.log(`< ${body.cmd} ${body.args.join(' ')}`);
                    }
                });
            });
            
            this.client.on('close', () => {
                console.log('[INFO] IrcClient.client<close>: disconnected from server');
                this.disconnect();
            });
        });
    }

    disconnect() {
        while (this.channels.length > 0) {
            this.part(this.channels[0]);
        }
        this.client.end();
        this.client.destroy();
        this.connected = false;
        this._onDisconnect.forEach(handler => handler());
    }

    msg(command, parameters, log) {
        if (!this.connected)
            throw 'IrcClient - not connected';

        const content = `${command} ${parameters.join(' ')}`;
        if (content.length > 510) {
            throw `IrcClient - message exceeds character limit (${content.length}/510)`;
        }
        this.client.write(`${content}\r\n`);
        if (log) {
            console.log(`> ${content}`);
        }
    }

    pass(token) {
        this.msg('PASS', [token], this.verbose);
    }

    nick(identity) {
        identity = identity.toLowerCase()
        this.msg('NICK', [identity], this.verbose);
        this.identity = identity;
    }

    join(channel) {
        channel = channel.toLowerCase();
        this.msg('JOIN', [`#${channel}`], this.verbose);
        this.channels.push(channel);
        console.log(`[INFO] IrcClient.join: ${channel}`);
    }

    part(channel) {
        channel = channel.toLowerCase();
        this.msg('PART', [`#${channel}`], this.verbose);
        this.channels = this.channels.filter(value => value !== channel);
        console.log(`[INFO] IrcClient.part: ${channel}`);
    }

    cap(name) {
        this.msg('CAP', ['REQ', name], this.verbose);
    }

    pong(server) {
        this.msg('PONG', [`:${server}`], this.verbose);
    }

    privmsg(channel, text) {
        channel = channel.toLowerCase();
        if (this.channels.indexOf(channel) >= 0) {
            this.msg('PRIVMSG', [`#${channel}`, `:${text}`], this.verbose);
            if (this.verbose)
                console.log(`> ${this.identity}: ${text}`);
        } else {
            throw `IrcClient - not connected to channel '${channel}'`;
        }
    }

    whisper(target, text) {
        target = target.toLowerCase()
        this.msg('PRIVMSG', ['jtv', `:.w ${target} ${text}`], this.verbose);
    }
}

module.exports = IrcClient;
