const Env = require('../../../helper/Env');
const { request } = require('../helper/https');
const { createHmac } = require("crypto");

const EventSubscriptionType = {
    CHANNEL_FOLLOW: 'channel.follow',
    CHANNEL_SUBSCRIBE: 'channel.subscribe',
    CHANNEL_GIFT: 'channel.subscription.gift',
    CHANNEL_REDEEM: 'channel.channel_points_custom_reward_redemption.add'
};

class EventSubscription {
    constructor(token, hostname, server) {
        this._token = token;
        this._hostname = hostname;
        this._server = server;
        this._subscriptions = {};

        if (!this._hostname) {
            console.error('[FATAL]: error!!!!!!!!!!!!!!!!!!!!!!!! 0vnP28cPS2 hostname is required');
            process.exit(1);
        }
    }

    _verifySignature(transport, headers, body) {
        const hmacMsg = [
            headers['twitch-eventsub-message-id'],
            headers['twitch-eventsub-message-timestamp'],
            body
        ].join('');
        
        const signature = 'sha256='
            + createHmac("sha256", transport.secret)
                .update(hmacMsg)
                .digest("hex");
                const data = 'test';

        return (signature === headers['twitch-eventsub-message-signature']);
    }

    _dummyEvent(transport, status, type, condition, hostname, uri) {
        const headers = {
            'Twitch-Eventsub-Message-Id': 'befa7b53-d79d-478f-86b9-120f112b044e',
            'Twitch-Eventsub-Message-Timestamp': '2019-11-16T10:11:12.123Z'
        };
        const body = {
            "subscription": {
                "id": "f1c2a387-161a-49f9-a165-0f21d7a4e1c4",
                "status": status,
                "type": type,
                "version": "1",
                "cost": 1,
                "condition": condition,
                "transport": {
                    "method": "webhook",
                    "callback": transport.callback
                },
                "created_at": "2019-11-16T10:11:12.123Z"
            }
        };
        
        if (status === 'webhook_callback_verification_pending') {
            body["challenge"] = "pogchamp-kappa-360noscope-vohiyo";
        } else if (status === 'enabled') {
            body["event"] = {
                "user_id": "1337",
                "user_login": "awesome_user",
                "user_name": "Awesome_User",
                "broadcaster_user_id":     "12826",
                "broadcaster_user_login":  "twitch",
                "broadcaster_user_name":   "Twitch"
            };
        }

        headers['Twitch-Eventsub-Message-Signature'] = 'sha256='
            + createHmac("sha256", transport.secret)
                .update([
                    headers['Twitch-Eventsub-Message-Id'],
                    headers['Twitch-Eventsub-Message-Timestamp'],
                    JSON.stringify(body)
                ].join(''))
                .digest("hex");

        hostname = hostname.replace('http://', '');
        hostname = hostname.replace('https://', '');
        request({
                protocol: 'HTTPS', method: 'POST',
                hostname, uri, headers, body
            }).then(res => console.log(res))
            .catch(err => console.error(err));
    }

    async createSubscription(subName, transport, type, condition, handler) {
        if (subName in this._subscriptions) {
            throw `error!!!!!!!!!!!!!!!!!!!!!!!! 51nPKeHPSQ subscription with name ${subName} already exists`;
        }

        const uri = transport.callback.replace(this._hostname, '');
        this._server.defineHandler('POST', uri, 
            (_, req, res) => {
                let chunks = [];
                req.on('error', (err) => {
                    console.error(err);
                    res.writeHead(500);
                    res.end(err);
                }).on('data', (chunk) => {
                    chunks.push(chunk);
                }).on('end', () => {
                    const body = Buffer.concat(chunks).toString();
                    if (!!body) {
                        if (!this._verifySignature(transport, req.headers, body)) {
                            res.writeHead(403);
                            res.end();
                        } else {
                            try {
                                const json = JSON.parse(body);
                                if ('challenge' in json && 'subscription' in json && 'status' in json['subscription']
                                        && json['subscription']['status'] === 'webhook_callback_verification_pending') {
                                    res.writeHead(200);
                                    res.end(json['challenge']);
                                } else if ('event' in json) {
                                    res.writeHead(200);
                                    res.end();
                                    handler({ type, event: json['event'] });
                                } else {
                                    res.writeHead(500);
                                    res.end();
                                    throw 'error!!!!!!!!!!!!!!!!!!!!!!!! c_WeiGdO4A';
                                }
                            } catch (err) {
                                res.writeHead(500);
                                res.end();
                                throw `error!!!!!!!!!!!!!!!!!!!!!!!! CZaAgd6eox ${err}`;
                            }
                        }
                    } else {
                        res.writeHead(500);
                        res.end();
                        throw 'error!!!!!!!!!!!!!!!!!!!!!!!! O5tCoDvRBc';
                    }
                });

            });

        let { body } = await request({
                method: 'POST',
                hostname: 'api.twitch.tv',
                uri: '/helix/eventsub/subscriptions',
                headers: {
                    'Client-ID': Env.get(this._token._vars.ID),
                    'Authorization': `Bearer ${Env.get(this._token._vars.TOKEN)}`,
                    'Content-Type': 'application/json'
                },
                body: {
                    "type": type,
                    "version": "1",
                    "condition": condition,
                    "transport": transport
                }
            });

        if (typeof body === 'object' && 'data' in body && Array.isArray(body['data'])
                && body['data'].length > 0 && 'id' in body['data'][0] && 'status' in body['data'][0]
                && body['data'][0]['status'] === 'webhook_callback_verification_pending') {
            setTimeout(() => {
                this._subscriptions[subName] = {
                    type, transport, condition,
                    status: body['data'][0]['status'],
                    id: body['data'][0]['id']
                };
            }, 1);
        } else {
            throw 'error!!!!!!!!!!!!!!!!!!!!!!!! VO8MYO0VMP';
        }
    }

    async deleteSubscription(subName) {
        if (!subName in this._subscriptions)
            return;

        const { headers, body } = await request({
                method: 'DELETE',
                hostname: 'api.twitch.tv',
                uri: '/helix/eventsub/subscriptions',
                headers: {
                    'Client-ID': Env.get(this._token._vars.ID),
                    'Authorization': `Bearer ${Env.get(this._token._vars.TOKEN)}`
                },
                query: { "id": this._subscriptions[subName].id }
            });
        console.log(`deleted eventSub ${subName}`);
    }

    async _listSubscription(status) {
        let { headers, body } = await request({
                method: 'GET',
                hostname: 'api.twitch.tv',
                uri: '/helix/eventsub/subscriptions',
                headers: {
                    'Client-ID': Env.get(this._token._vars.ID),
                    'Authorization': `Bearer ${Env.get(this._token._vars.TOKEN)}`,
                    'Accepts': 'appication/json'
                },
                query: { status }
            });

        if (typeof body === 'object' && 'data' in body && Array.isArray(body['data'])) {
            body['data'].forEach((sub, idx) => {
                    this._subscriptions['_' + idx] = {
                        type: sub.type,
                        transport: sub.transport,
                        condition: sub.condition,
                        status: sub.status,
                        id: sub.id
                    }
                });
        }

        return this._subscriptions;
    }

    cleanup() {
        return Promise.all(Object.keys(this._subscriptions)
            .map(key => this.deleteSubscription(key)));
    }
}


module.exports = {
    EventSubscriptionType,
    EventSubscription
};
