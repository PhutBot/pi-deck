const { Millis } = require('./helper/Millis');

const CmdScopes = {
    VIEWER: 'viewer',
    FOLLOWER: 'follower',
    SUBSCRIBER: 'subscriber',
    VIP: 'vip',
    MODERATOR: 'moderator',
    BROADCASTER: 'broadcaster',
};

class ChatCmd {
    constructor(headers, columns) {
        this.ENABLED = false;
        this.NAME = null;
        this.DESCRIPTION = null;
        this.SCOPE = CmdScopes.BROADCASTER;
        this.ARGUMENT_MAP = {};
        this.OUTPUTS = [];
        this.GLOBAL_COOLDOWN = 100;
        this.USER_COOLDOWN = Millis.fromSec(5);

        headers.forEach((header, idx) => {
            switch (header) {
                case 'ENABLED':         this.ENABLED = (columns[idx] === 'T'); break;
                case 'NAME':            this.NAME = columns[idx]; break;
                case 'DESCRIPTION':     this.DESCRIPTION = columns[idx]; break;
                case 'SCOPE':           this.SCOPE = (columns[idx].toUpperCase() in CmdScopes) ? CmdScopes[columns[idx].toUpperCase()] : CmdScopes.BROADCASTER; break;
                case 'ARGUMENT_MAP':    this.ARGUMENT_MAP = this._getArgMap(columns[idx]); break;
                case 'OUTPUT':          !!columns[idx] ? this.OUTPUTS.push(columns[idx]) : 0; break;
                case 'GLOBAL_COOLDOWN': try { this.GLOBAL_COOLDOWN = Number.parseInt(columns[idx]) } catch (err) { console.error(`ChatCmd - ${err}`)}; break;
                case 'USER_COOLDOWN': try { this.USER_COOLDOWN = Number.parseInt(columns[idx]) } catch (err) { console.error(`ChatCmd - ${err}`)}; break;
            }
        });
    }

    get enabled() {
        return this.ENABLED;
    }

    get name() {
        return this.NAME;
    }

    get description() {
        return this.DESCRIPTION;
    }

    get scope() {
        return this.SCOPE;
    }

    get args() {
        return Object.keys(this.ARGUMENT_MAP);
    }

    get outputs() {
        return this.OUTPUTS;
    }

    get globalCooldown() {
        return this.GLOBAL_COOLDOWN;
    }

    get userCooldown() {
        return this.USER_COOLDOWN;
    }
    
    getArg(name, parts) {
        if (name in this.ARGUMENT_MAP) {
            const idx = this.ARGUMENT_MAP[name];
            if (idx < parts.length) {
                return parts[idx].startsWith('@') ? parts[idx].slice(1) : parts[idx];
            }
        }
        return null;
    }

    getArgs(msg) {
        const result = {};
        if (this.args.length > 0) {
            const parts = msg.split(' ');
            this.args.forEach(arg => {
                const val = this.getArg(arg, parts);
                if (!!val) {
                    result[arg] = val;
                }
            });
        }
        return result;
    }

    _getArgMap(column) {
        const result = {};
        const parts = column.split(' ');
        parts.forEach(part => {
            const [name, posStr] = part.split('@');
            const pos = Number.parseInt(posStr);
            result[name] = pos;
        })
        return result;
    }
}

module.exports = {
    CmdScopes,
    ChatCmd
};
