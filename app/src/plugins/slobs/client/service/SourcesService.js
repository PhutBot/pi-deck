module.exports = class SourcesService {
    constructor(client) {
        this._client = client;
    }

    sourceAdded() {
        return this._client.when('SourcesService', 'sourceAdded');
    }

    sourceRemoved() {
        return this._client.when('SourcesService', 'sourceRemoved');
    }

    sourceUpdated() {
        return this._client.when('SourcesService', 'sourceUpdated');
    }

    addFile(path, compactMode=true) {
        return this._client.call('SourcesService', 'addFile', [ path ], compactMode);
    }

    createSource(name, type, settings, options, compactMode=true) {
        return this._client.call('SourcesService', 'createSource', [ name, type, settings, options ], compactMode);
    }

    getAvailableSourcesTypesList() {
        return this._client.when('SourcesService', 'getAvailableSourcesTypesList');
    }

    getSource(id, compactMode=true) {
        return this._client.call('SourcesService', 'getSource', [ id ], compactMode);
    }

    getSources(compactMode=true) {
        return this._client.call('SourcesService', 'getSources', [], compactMode);
    }

    getSourcesByName(name, compactMode=true) {
        return this._client.call('SourcesService', 'getSourcesByName', [ name ], compactMode);
    }

    removeSource(id, compactMode=true) {
        return this._client.call('SourcesService', 'removeSource', [ id ], compactMode);
    }

    showAddSource(sourceType, compactMode=true) {
        return this._client.call('SourcesService', 'showAddSource', [ sourceType ], compactMode);
    }

    showShowcase(compactMode=true) {
        return this._client.call('SourcesService', 'showShowcase', [], compactMode);
    }

    showSourceProperties(id, compactMode=true) {
        return this._client.call('SourcesService', 'showSourceProperties', [ id ], compactMode);
    }
};
