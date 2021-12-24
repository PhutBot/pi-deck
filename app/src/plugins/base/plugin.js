const { Env } = require('helper-js');

module.exports = class BasePlugin {
    static _logger = require('npmlog');
    static _serverAddress = null;

    constructor({ name, version, description, author }) {
        this._target = 'pi-deck';
        this._type = 'plugin';
        this._name = name;
        this._version = version;
        this._description = description;
        this._author = author;
    }

    async init() {
        // called once on first load
    }

    async cleanup() {
        // called once before unload
    }

    async activate() {
        // called before each plugin operation
    }

    async deactivate() {
        // called after each plugin operation
    }

    async execute(op, body={}) {
        if (op in this.operations) {
            let valid = true;
            if ('request' in this.operations[op]) {
                Object.entries(this.operations[op].request)
                    .forEach(([ name, desc ]) => {
                            if (typeof desc === 'string') {
                                desc = { type: desc };
                            }

                            if ((!(name in body) || !body[name])) {
                                if ('defaultValue' in desc) {
                                    body[name] = desc.defaultValue;
                                } else {
                                    this.logger.error(this.name, `missing required arg: ${name}`);
                                    valid = false;
                                }
                            }
                            
                            if (!!body[name] && typeof body[name] !== desc.type) {
                                this.logger.error(this.name, `invalid type(${typeof body[name]}) for arg: ${name}(${desc.type})`);
                                valid = false;
                            }
                        });
            }
            
            if (valid)  {
                try {
                    await this.activate();
                    const result = await this[op](body);
                    await this.deactivate();
                    return result;
                } catch (err) {
                    this.logger.error(this.name,
                        err instanceof Error ? err.message : err);
                }
            } else {
                throw `failed to call ${this.name}.${op}`;
            }
        } else {
            throw new Error(`unknown operation: ${op}`);
        }
    }

    get operations() {
        return {};
    }

    get endpoints() {
        return [];
    }

    get target() {
        return this._target;
    }

    get type() {
        return this._type;
    }

    get name() {
        return this._name;
    }

    get version() {
        return this._version;
    }

    get description() {
        return this._description;
    }

    get author() {
        return this._author;
    }

    get baseUri() {
        return `/plugin/${this.name}`;
    }

    get serverAddress() {
        return BasePlugin._serverAddress;
    }

    get env() {
        return Env;
    }

    get logger() {
        return BasePlugin._logger;
    }
};