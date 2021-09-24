require('./helper/helper');
const logger = require('npmlog');
const { Server } = require("./server");
const BasePlugin = require('./plugins/base/plugin');
const Env = require('./helper/Env');

(async function() {
    try {
        // Env.load('.env');
        const port = Env.get('PI_DECK.PORT');

        const server = new Server(port);
        server.start();

        BasePlugin._serverAddress = server.address.includes('0.0.0.0')
            ? `http://localhost:${server.port}` : server.address;

        const plugins = LoadPlugins(server, [ 'core', 'slobs', 'twitch' ]);
        server.onStop = () => cleanupPlugins(server, plugins);
        server.defineHandler({ method: 'GET', path: '/shutdown', handler: (url, req, res) => {
                res.writeHead(200);
                res.end();
                setTimeout(() => server.stop(), 1000);
            }});
        server.defineWildHandler({ method: 'GET', pattern: '/wild/*', handler: (url, req, res) => {
                res.writeHead(200);
                res.end('OK');
            }});
        server.start();

        await plugins['core'].execute('log', { msg: 'this is a test log' });
        if ('slobs' in plugins) {
            let result = await plugins.slobs.execute('getSceneNames');
            logger.info('entrypoint', JSON.stringify(result, (key, val) => key === '_client' ? undefined : val));
            
            result = await plugins.slobs.execute('makeSceneActive', { name: 'BRB' });
            logger.info('entrypoint', JSON.stringify(result, (key, val) => key === '_client' ? undefined : val));
        }
    } catch (err)  {
        logger.error('entrypoint', err);
    }
})();

async function LoadPlugin(server, pluginName) {
    logger.info(__function, pluginName);

    let module = null;
    try {
        module = require(`./plugins/${pluginName}/plugin.js`);
    } catch (err) {
        console.error(err);
        throw `plugin not found: ${pluginName}`;
    }

    if (!!module && module.__proto__ === BasePlugin) {
        const plugin = new module();
        
        await plugin.init();
        plugin.endpoints.forEach(endpoint => {
                if ('pattern' in endpoint) {
                    server.defineWildHandler({
                            ...endpoint,
                            pattern: `${plugin.baseUri}/${endpoint.pattern}`
                        });
                } else {
                    server.defineHandler({
                            ...endpoint,
                            path: `${plugin.baseUri}/${endpoint.path}`
                        });
                }
            });
            
        return plugin;
    } else {
        throw 'module is not a pi-deck plugin';
    }
}

async function LoadPlugins(server, pluginNames) {
    if (!Array.isArray(pluginNames))
        throw new Error('pluginNames must be of type: Array');

    const plugins = {};

    await Promise.allSettled(pluginNames.map(name => LoadPlugin(server, name)))
        .then(results => {
            results.forEach(result => {
                    if (result.status === 'rejected')
                        logger.error(__function, result.reason)
                    else
                        plugins[result.value.name] = result.value;
                });
        });

    return plugins;
}

async function cleanupPlugin(server, plugin) {
    logger.info(__function, plugin.name);

    await plugin.deactivate();
    await plugin.cleanup();
    plugin.endpoints.forEach(endpoint => {
            server.removeHandler({
                    ...endpoint,
                    path: `/plugin/${plugin.name}/${endpoint.path}`
                });
        });
}

function cleanupPlugins(server, plugins) {
    Object.values(plugins).forEach(plugin => {
            cleanupPlugin(server, plugin);
        });
}

