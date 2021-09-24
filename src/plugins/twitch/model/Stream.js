const { assign, assignArray } = require("../helper/Serializable");
const Model = require("./Model");


module.exports = class Stream extends Model {
    constructor(api, json) {
        super(api);
        assign(this, json, 'id', String);
        assign(this, json, 'user_id', String);
        assign(this, json, 'user_login', String);
        assign(this, json, 'user_name', String);
        assign(this, json, 'game_id', String);
        assign(this, json, 'game_name', String);
        assign(this, json, 'type', String);
        assign(this, json, 'title', String);
        assign(this, json, 'viewer_count', Number);
        assign(this, json, 'started_at', Date);
        assign(this, json, 'language', String);
        assign(this, json, 'thumbnail_url', String);
        assignArray(this, json, 'tag_ids', String);
        assign(this, json, 'is_mature', Boolean);
    }

    // get channel() {
    //     return this._api.user
    // }

    // get user() {
    //     return this._api.user
    // }

    get id() {
        return this._id;
    }

    get game_id() {
        return this._game_id;
    }

    get game_name() {
        return this._game_name;
    }

    get title() {
        return this._title;
    }

    get viewer_count() {
        return this._viewer_count;
    }

    get creation_date() {
        return this._started_at;
    }

    get is_mature() {
        return this._is_mature;
    }
};
