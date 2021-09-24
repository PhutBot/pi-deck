const { assign } = require("../helper/Serializable");
const Model = require("./Model");


module.exports = class Channel extends Model {
    constructor(api, json) {
        super(api);
        assign(this, json, 'broadcaster_id', String);
        assign(this, json, 'broadcaster_login', String);
        assign(this, json, 'broadcaster_name', String);
        assign(this, json, 'broadcaster_language', String);
        assign(this, json, 'game_id', String);
        assign(this, json, 'game_name', String);
        assign(this, json, 'title', String);
        assign(this, json, 'delay', Number);
    }

    // get user() {
    //     return this._api.user
    // }

    // get stream() {
    //     return this._api.user
    // }

    get last_game_id() {
        return this._game_id;
    }

    get last_game_name() {
        return this._game_name;
    }

    get stream_delay() {
        return this._delay;
    }
};
