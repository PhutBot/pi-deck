module.exports = class StreamingService {
    constructor(client) {
        this._client = client;
    }

    recordingStatusChange() {
        return this._client.when('StreamingService', 'recordingStatusChange');
    }

    replayBufferStatusChange() {
        return this._client.when('StreamingService', 'replayBufferStatusChange');
    }

    streamingStatusChange() {
        return this._client.when('StreamingService', 'streamingStatusChange');
    }

    getModel(compactMode=true) {
        return this._client.call('StreamingService', 'getModel', [], compactMode);
    }

    saveReplay(compactMode=true) {
        return this._client.call('StreamingService', 'saveReplay', [], compactMode);
    }

    startReplayBuffer(compactMode=true) {
        return this._client.call('StreamingService', 'startReplayBuffer', [], compactMode);
    }

    stopReplayBuffer(compactMode=true) {
        return this._client.call('StreamingService', 'stopReplayBuffer', [], compactMode);
    }

    toggleRecording(compactMode=true) {
        return this._client.call('StreamingService', 'toggleRecording', [], compactMode);
    }

    toggleStreaming(compactMode=true) {
        return this._client.call('StreamingService', 'toggleStreaming', [], compactMode);
    }
};
