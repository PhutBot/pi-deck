module.exports = class TransitionsService {
    constructor(client) {
        this._client = client;
    }

    studioModeChanged() {
        return this._client.when('TransitionsService', 'studioModeChanged');
    }

    disableStudioMode(compactMode=true) {
        return this._client.call('TransitionsService', 'disableStudioMode', [], compactMode);
    }

    enableStudioMode(compactMode=true) {
        return this._client.call('TransitionsService', 'enableStudioMode', [], compactMode);
    }

    executeStudioModeTransition(compactMode=true) {
        return this._client.call('TransitionsService', 'executeStudioModeTransition', [], compactMode);
    }

    getModel(compactMode=true) {
        return this._client.call('TransitionsService', 'getModel', [], compactMode);
    }
};
