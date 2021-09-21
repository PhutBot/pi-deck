module.exports = class Scene {
    constructor(client, json) {
        this._client = client;

        this._id = json.id;
        this._resourceId = json.resourceId;
        this._name = json.name;
        this._nodes = json.nodes;
    }

    get id() { return this._id; };
    get resourceId() { return this._resourceId; };
    get name() { return this._name; };
    get nodes() { return this._nodes; };

    addFile(path, folderId, compactMode=true) {
        return this._client.call(this.resourceId, 'addFile', [ path, folderId ], compactMode);
    }

    addSource(sourceId, options, compactMode=true) {
        return this._client.call(this.resourceId, 'addSource', [ sourceId, options ], compactMode);
    }

    canAddSource(sourceId, compactMode=true) {
        return this._client.call(this.resourceId, 'canAddSource', [ sourceId ], compactMode);
    }

    clear(compactMode=true) {
        return this._client.call(this.resourceId, 'clear', [], compactMode);
    }

    createAndAddSource(name, type, settings, compactMode=true) {
        return this._client.call(this.resourceId, 'createAndAddSource', [ name, type, settings ], compactMode);
    }

    createFolder(name, compactMode=true) {
        return this._client.call(this.resourceId, 'createFolder', [ name ], compactMode);
    }

    getFolder(sceneFolderId, compactMode=true) {
        return this._client.call(this.resourceId, 'getFolder', [ sceneFolderId ], compactMode);
    }

    getFolders(compactMode=true) {
        return this._client.call(this.resourceId, 'getFolders', [], compactMode);
    }

    getItem(sceneItemId, compactMode=true) {
        return this._client.call(this.resourceId, 'getItem', [ sceneItemId ], compactMode);
    }

    getItems(compactMode=true) {
        return this._client.call(this.resourceId, 'getItems', [], compactMode);
    }

    getModel(compactMode=true) {
        return this._client.call(this.resourceId, 'getModel', [], compactMode);
    }

    getNestedItems(compactMode=true) {
        return this._client.call(this.resourceId, 'getNestedItems', [], compactMode);
    }

    getNestedScenes(compactMode=true) {
        return this._client.call(this.resourceId, 'getNestedScenes', [], compactMode);
    }

    getNestedSources(compactMode=true) {
        return this._client.call(this.resourceId, 'getNestedSources', [], compactMode);
    }

    async getNode(sceneNodeId, compactMode=true) {
        return this._client.call(this.resourceId, 'getNode', [ sceneNodeId ], compactMode);
    }

    async getNodeByName(name, compactMode=false) {
        return this._client.call(this.resourceId, 'getNodeByName', [ name ], compactMode);
    }

    async getNodes(compactMode=true) {
        return this._client.call(this.resourceId, 'getNodes', [], compactMode);
    }

    getRootNodes(compactMode=true) {
        return this._client.call(this.resourceId, 'getRootNodes', [], compactMode);
    }

    getSelection(ids, compactMode=true) {
        return this._client.call(this.resourceId, 'getSelection', [ ids ], compactMode);
    }

    getSource(compactMode=true) {
        return this._client.call(this.resourceId, 'getSource', [], compactMode);
    }

    makeActive(compactMode=true) {
        return this._client.call(this.resourceId, 'makeActive', [], compactMode);
    }

    remove(compactMode=true) {
        return this._client.call(this.resourceId, 'remove', [], compactMode);
    }

    removeFolder(folderId, compactMode=true) {
        return this._client.call(this.resourceId, 'removeFolder', [ folderId ], compactMode);
    }

    removeItem(sceneItemId, compactMode=true) {
        return this._client.call(this.resourceId, 'removeItem', [ sceneItemId ], compactMode);
    }

    setName(newName, compactMode=true) {
        return this._client.call(this.resourceId, 'setName', [ newName ], compactMode);
    }
};
