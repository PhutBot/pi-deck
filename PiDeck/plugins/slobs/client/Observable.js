module.exports = class Observable {
    constructor() {
        this._eventCallbacks = [];
        this._errorCallback = (err) => {
            throw new Error('unhandled exception in Observable class', { cause: err });
        };
    }

    onEvent(resolve) {
        this._eventCallbacks.push(resolve);
        return this;
    }

    onError(reject) {
        this._errorCallback = reject;
        return this;
    }

    triggerEvent(data) { this._eventCallbacks.forEach(callback => callback(data)); }
    triggerError(err) { this._errorCallback(err); }
};
