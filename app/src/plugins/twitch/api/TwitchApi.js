const https = require('https');
const Env = require('../../../helper/Env');
const { request } = require('../helper/https');
const { Millis } = require('../helper/Millis');

class TwitchApi {
    static MAX_RETRY = 1;

    constructor(token) {
        this._token = token;
        this._cache = {
            users: {},
            channels: {},
            streams: {},
            moderators: {},
            follows: {},
            subscriptions: {}
        };
    }

    users(login, cacheTime=0) {
        return new Promise((resolve, reject) => {
                if (login in this._cache.users && (!Array.isArray(login) || login.length === 1)) {
                    const cached = this._cache.users[login];
                    const elapsed = Date.now() - cached.timestamp;
                    if (elapsed < cacheTime) {
                        resolve([ cached.data ]);
                        return;
                    }
                }

                this._api('users', { login })
                    .then(res => {
                            res.data.forEach(user => this._cache.users[user.login] = { timestamp: Date.now(), data: user } );
                            resolve(res.data)
                        })
                    .catch(err => reject(`TwitchApi.users - ${err}`));
            });
    }

    channels(login, cacheTime=0) {
        return new Promise((resolve, reject) => {
                if (login in this._cache.channels && (!Array.isArray(login) || login.length === 1)) {
                    const cached = this._cache.channels[login];
                    const elapsed = Date.now() - cached.timestamp;
                    if (elapsed < cacheTime) {
                        resolve([ cached.data ]);
                        return;
                    }
                }

                this.users(login, Millis.inf())
                    .then(res => {
                            const broadcaster_id = res.map(user => user.id);
                            this._api('channels', { broadcaster_id })
                                .then(res => {
                                        res.data.forEach(channel => this._cache.channels[channel.broadcaster_login] = { timestamp: Date.now(), data: channel } );
                                        resolve(res.data)
                                    })
                                .catch(err => reject(`TwitchApi.channels - ${err}`));
                        })
                    .catch(err => reject(err));
            });
    }

    streams(login, cacheTime=0) {
        return new Promise((resolve, reject) => {
                if (login in this._cache.streams && (!Array.isArray(login) || login.length === 1)) {
                    const cached = this._cache.streams[login];
                    const elapsed = Date.now() - cached.timestamp;
                    if (elapsed < cacheTime) {
                        resolve([ cached.data ]);
                        return;
                    }
                }
                
                this._api('streams', { user_login: login })
                    .then(res => {
                            res.data.forEach(stream => this._cache.streams[stream.user_login] = { timestamp: Date.now(), data: stream } );
                            resolve(res.data)
                        })
                    .catch(err => reject(`TwitchApi.streams - ${err}`));
            });
    }

    moderators(login, cacheTime=0) {
        return new Promise((resolve, reject) => {
                if (login in this._cache.moderators && (!Array.isArray(login) || login.length === 1)) {
                    const cached = this._cache.moderators[login];
                    const elapsed = Date.now() - cached.timestamp;
                    if (elapsed < cacheTime) {
                        resolve(cached.data);
                        return;
                    }
                }

                this.users(login, Millis.inf())
                    .then(res => {
                            const broadcaster_id = res.map(user => user.id);
                            this._api('moderation/moderators', { broadcaster_id })
                                .then(res => {
                                        this._cache.moderators[login] = { timestamp: Date.now(), data: res.data };
                                        resolve(res.data);
                                    })
                                .catch(err => reject(`TwitchApi.moderators - ${err}`));
                        })
                    .catch(err => reject(err));
            });
    }

    follows(from_login, to_login, cacheTime=0, params={}) {
        const cacheKey = `${from_login}=>${to_login}`;

        params = Object.assign({
            first: 9999999999
        }, params);

        return new Promise((resolve, reject) => {
                if (cacheKey in this._cache.follows) {
                    const cached = this._cache.follows[cacheKey];
                    const elapsed = Date.now() - cached.timestamp;
                    if (elapsed < cacheTime) {
                        resolve(cached.data);
                        return;
                    }
                }
            
                let users = [];
                if (!!from_login)
                    users.push(from_login);
                if (!!to_login)
                    users.push(to_login);

                this.users(users, Millis.inf())
                    .then(res => {
                            const user_ids = res.map(user => user.id);

                            let from_id, to_id;
                            if (user_ids.length > 1) {
                                [ from_id, to_id ] = user_ids;
                            } else if (user_ids.length > 0) {
                                to_id = user_ids[0];
                            } else {
                                throw 'error: TODO WRITE AN ERROR MSG; no users found /users/follows';
                            }
                            
                            const searchParams = Object.assign({}, params);
                            searchParams.first = Math.min(Math.max(1, params.first), 100);
                            
                            if (!!from_id)
                                searchParams['from_id'] = from_id;
                            if (!!to_id)
                                searchParams['to_id'] = to_id;
                            
                            this._paginate('users/follows', searchParams, params.first)
                                .then(data => {
                                    if (cacheTime > 0) {
                                        this._cache.follows[cacheKey] = { timestamp: Date.now(), data };
                                    }
                                    resolve(data);
                                })
                                .catch(err => reject(`TwitchApi.follows - ${err}`));
                        })
                    .catch(err => reject(err));
            });
    }

    subscriptions(from_login, to_login, cacheTime=0) {
        const cacheKey = `${from_login}=>${to_login}`;
        return new Promise((resolve, reject) => {
                if (cacheKey in this._cache.subscriptions) {
                    const cached = this._cache.subscriptions[cacheKey];
                    const elapsed = Date.now() - cached.timestamp;
                    if (elapsed < cacheTime) {
                        resolve(cached.data);
                        return;
                    }
                }
            
                let params = [];
                if (!!from_login)
                    params.push(from_login);
                if (!!to_login)
                    params.push(to_login);

                this.users(params, Millis.inf())
                    .then(res => {
                            const [ from_id, to_id ] = res.map(user => user.id);
                            
                            let params = {};
                            if (!!from_id)
                                params['user_id'] = from_id;
                            if (!!to_id)
                                params['broadcaster_id'] = to_id;
                                
                            this._api('subscriptions', params)
                                .then(res2 => {
                                        this._cache.subscriptions[cacheKey] = { timestamp: Date.now(), data: res2.data };
                                        resolve(res2.data);
                                    })
                                .catch(err => reject(`TwitchApi.subscriptions - ${err}`));
                        })
                    .catch(err => reject(err));
            });
    }

    getCustomReward(broadcaster_id, only_manageable_rewards=true) {
        return new Promise((resolve, reject) => {
            request({
                method: 'GET',
                hostname: 'api.twitch.tv',
                uri: '/helix/channel_points/custom_rewards',
                query: { broadcaster_id, only_manageable_rewards },
                headers: {
                    'Client-ID': Env.get(this._token._vars.ID),
                    'Authorization': `Bearer ${Env.get(this._token._vars.TOKEN)}`,
                    'Content-Type': 'application/json'
                }
            }).then(response => resolve(response.body))
            .catch(err => reject(err));
        });
    }

    createCustomReward(broadcaster_id, title, cost, prompt=undefined, is_user_input_required=false, should_redemptions_skip_request_queue=false) {
        return new Promise((resolve, reject) => {
            request({
                method: 'POST',
                hostname: 'api.twitch.tv',
                uri: '/helix/channel_points/custom_rewards',
                query: { broadcaster_id },
                headers: {
                    'Client-ID': Env.get(this._token._vars.ID),
                    'Authorization': `Bearer ${Env.get(this._token._vars.TOKEN)}`,
                    'Content-Type': 'application/json'
                },
                body: { cost, title, prompt, is_user_input_required, should_redemptions_skip_request_queue }
            }).then(response => resolve(response.body))
            .catch(err => reject(err));
        });
    }

    updateRedemptionStatus(broadcaster_id, reward_id, id, status) {
        return new Promise((resolve, reject) => {
            request({
                method: 'PATCH',
                hostname: 'api.twitch.tv',
                uri: '/helix/channel_points/custom_rewards/redemptions',
                query: { broadcaster_id, id, reward_id },
                headers: {
                    'Client-ID': Env.get(this._token._vars.ID),
                    'Authorization': `Bearer ${Env.get(this._token._vars.TOKEN)}`,
                    'Content-Type': 'application/json'
                },
                body: { status }
            }).then(response => resolve(response.body))
            .catch(err => reject(err));
        });
    }

    // TODO: paginate the other api calls
    _paginate(endpoint, params, want) {
        let notFound = want;
        return new Promise((resolve, reject) => {
            this._api(endpoint, params)
                .then(async (response) => {
                    let data = response.data;
                    notFound -= data.length;
                    if ('pagination' in response && 'cursor' in response.pagination
                            && (want < 0 || notFound > 0)) {
                        params['after'] = response.pagination.cursor;
                        const moreData = await this._paginate(endpoint, params, notFound);
                        data = data.concat(moreData);
                    }
                    resolve(data);
                })
                .catch(err => reject(err));
        });
    }

    _api(uri, params={}, retry=true, depth=0) {
        return new Promise((resolve, reject) => {
            let path = uri;
            Object.entries(params).forEach(([ key, val ], idx) => {
                    if (Array.isArray(val)) {
                        val.forEach((item, idx2) => {
                            const del = idx === 0 && idx2 === 0 ? '?' : '&';
                            path += `${del}${key}=${item}`;
                        });
                    } else {
                        const del = idx === 0 ? '?' : '&';
                        path += `${del}${key}=${val}`;
                    }
                });
            https.get({
                    hostname: 'api.twitch.tv',
                    path: `/helix/${path}`,
                    headers: {
                        'Client-ID': Env.get(this._token._vars.ID),
                        'Authorization': `Bearer ${Env.get(this._token._vars.TOKEN)}`
                    }
                }, (res) => {
                    let data = '';
                    res.on('data', (chunk) => data += chunk);
                    res.on('error', (err) => reject(err));
                    res.on('end', () => {
                            const json = JSON.parse(data);
                            if (!!json.error) {
                                if (json.status === 401 && retry) {
                                    if (!Env.get(this._token._vars.REFRESH) || depth >= TwitchApi.MAX_RETRY) {
                                        console.error(`[FATAL] TwitchApi._api: ${json.message}`);
                                        process.exit(1);
                                    } else {
                                        this._token._refresh() // refresh token and retry
                                            .then(() => {
                                                this._api(uri, params, retry, depth+1)
                                                    .then(result => resolve(result))
                                                    .catch(err => {
                                                        if (depth >= TwitchApi.MAX_RETRY) {
                                                            console.error(`[FATAL] TwitchApi._api: ${err}`);
                                                            process.exit(1);
                                                        } else {
                                                            reject(err);
                                                        }
                                                    });
                                            })
                                            .catch((err) => {
                                                if (depth >= TwitchApi.MAX_RETRY) {
                                                    console.error( `[FATAL] TwitchApi._api: ${err}`);
                                                    process.exit(1);
                                                } else {
                                                    reject(err);
                                                }
                                            });
                                    }
                                } else {
                                    reject(json.message);
                                }
                            } else {
                                resolve(json);
                            }
                        });
                });
        });
    }
}

module.exports = TwitchApi;
