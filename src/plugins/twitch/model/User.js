const { assign } = require("../helper/Serializable");
const Model = require("./Model");


module.exports = class User extends Model {
    constructor(api, json) {
        super(api);
        assign(this, json, 'id', String);
        assign(this, json, 'login', String);
        assign(this, json, 'display_name', String);
        assign(this, json, 'type', String);
        assign(this, json, 'broadcaster_type', String);
        assign(this, json, 'description', String);
        assign(this, json, 'profile_image_url', String);
        assign(this, json, 'offline_image_url', String);
        assign(this, json, 'view_count', Number);
        assign(this, json, 'email', String);
        assign(this, json, 'created_at', Date);
    }

    // get channel() {
    //     return this._api.user
    // }

    // get stream() {
    //     return this._api.user
    // }

    get id() {
        return this._id;
    }

    get login() {
        return this._login;
    }

    get name() {
        return this._display_name;
    }

    get creation_date() {
        return this._created_at;
    }
};
