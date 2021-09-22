const Observable = require('../Observable');
const Scene = require("../model/Scene");

module.exports = class ScenesService {
    constructor(client) {
        this._client = client;
        this._scenes = null;
        this._events = {
            itemAdded: this._client.when('ScenesService', 'itemAdded'),
            itemRemoved: this._client.when('ScenesService', 'itemRemoved'),
            itemUpdated: this._client.when('ScenesService', 'itemUpdated'),
            sceneAdded: new Observable(),
            sceneRemoved: new Observable(),
            sceneSwitched:this._client.when('ScenesService', 'sceneSwitched')
        };
        
        this.getScenes(false);

        this._client.when('ScenesService', 'sceneAdded')
            .onEvent(response => {
                this.getScene(response.result.data.id)
                    .then(scene => this._scenes.push(scene))
                    .catch(err => console.error(err));
                this._events.sceneAdded.triggerEvent(response);
            })
            .onError(err => {
                this._events.sceneAdded.triggerError(err);
            });
        
        this._client.when('ScenesService', 'sceneRemoved')
            .onEvent(response => {
                this._scenes = this._scenes.filter(scene => scene.id !== response.result.data.id);
                this._events.sceneRemoved.triggerEvent(response);
            })
            .onError(err => {
                this._events.sceneRemoved.triggerError(err);
            });
    }

    get events() {
        return this._events;
    }

    activeScene(compactMode=false) {
        return this._client.call('ScenesService', 'activeScene', [], compactMode);
    }

    activeSceneId(compactMode=false) {
        return this._client.call('ScenesService', 'activeSceneId', [], compactMode);
    }

    // itemAdded() {
    //     return this._client.when('ScenesService', 'itemAdded');
    // }

    // itemRemoved() {
    //     return this._client.when('ScenesService', 'itemRemoved');
    // }

    // itemUpdated() {
    //     return this._client.when('ScenesService', 'itemUpdated');
    // }

    // sceneAdded() {
    //     return this._client.when('ScenesService', 'sceneAdded');
    // }

    // sceneRemoved() {
    //     return this._client.when('ScenesService', 'sceneRemoved');
    // }

    // sceneSwitched() {
    //     return this._client.when('ScenesService', 'sceneSwitched');
    // }

    createScene(name, compactMode=false) {
        return this._client.call('ScenesService', 'createScene', [ name ], compactMode);
    }

    async getScene(id, compactMode=false) {
        const response = await this._client.call('ScenesService', 'getScene', [ id ], compactMode);
        return new Scene(this._client, response.result);
    }

    getScenes(compactMode=false) {
        if (!!this._scenes)
            return Promise.resolve(this._scenes);

        this._scenes = [];
        return new Promise((resolve, reject) => {
            this._client.call('ScenesService', 'getScenes', [], compactMode)
                .then(response => {
                    this._scenes = response.result.map(
                        json => new Scene(this._client, json));
                    resolve(this._scenes);
                }).catch(reject);
        });
    }

    makeSceneActive(id, compactMode=false) {
        return this._client.call('ScenesService', 'makeSceneActive', [ id ], compactMode);
    }

    removeScene(id, compactMode=false) {
        return this._client.call('ScenesService', 'removeScene', [ id ], compactMode);
    }

    // undocumented api functions
    getSceneNames(compactMode=false) {
        return this._client.call('ScenesService', 'getSceneNames', [], compactMode);
    }

    // helper functions
    async getSceneById(id) {
        const scenes = (await this.getScenes()).filter(scene => scene.id === id);
        return scenes.length > 0 ? scenes[0] : null;
    }

    async getSceneByName(name) {
        const scenes = (await this.getScenes()).filter(scene => scene.name === name);
        return scenes.length > 0 ? scenes[0] : null;
    }
};
