const { assignArray, assign } = require("../helper/Serializable");
const Model = require("./Model");

class Pagination {
    constructor(json) {
        assign(this, json, 'cursor', String); 
    }
}

class Response {
    constructor(json, type) {
        if (!type instanceof Model) 
            throw `type '${'name' in type ? type.name : type}' is not an instance of model`;
        assignArray(this, json, 'data', type);
        assign(this, json, 'pagination', Pagination);
    }

    get data() {
        return this._data;
    }

    get first() {
        return this._data.length > 0 ? this._data[0]
            : null;
    }

    get last() {
        return this._data.length > 0 ? this._data[this._data.length-1]
            : null;
    }

    get cursor() {
        return !!this._pagination ? this._pagination._cursor
            : null; 
    }
}