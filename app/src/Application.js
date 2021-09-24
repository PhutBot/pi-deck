const { Server } = require("./server");
const BasePlugin = require('./plugins/base/plugin');

class Application {
    static _logger = require('npmlog');

    constructor() {
        // Env.load('.env');
        const port = Env.get('PI_DECK.PORT');
        this._server = new Server(port);
        this._server.onStop = () => this.unloadPlugins(Object.keys(this._plugins));
        this._server.defineHandler({ method: 'GET', path: '/shutdown', handler: async ({}, _, res) => {
            res.writeHead(200);
            res.end();
            setTimeout(() => this._server.stop(), 1000);
        }});
        
        BasePlugin._serverAddress = this._server.address;

        this._plugins = {};
        this.loadPlugin('core');
    }

    static get logger() {
        return this._logger;
    }
    
    async run() {
        try {
            this._server.start();
        } catch (err)  {
            Application.logger.error('Application', err);
        }
    }

    async loadPlugin(name) {
        Application.logger.info('Application', `loading plugin [${name}]`);
    
        let Plugin = null;
        try {
            Plugin = require(`./plugins/${name}/plugin.js`);
        } catch (err) {
            console.error(err);
            throw `plugin not found [${name}]`;
        }
    
        if (!!Plugin && Plugin.__proto__ === BasePlugin) {
            const plugin = new Plugin();
            
            await plugin.init();
            plugin.endpoints.forEach(endpoint => {
                    if ('pattern' in endpoint) {
                        this._server.defineWildHandler({
                                ...endpoint,
                                pattern: `/plugin/${name}/${endpoint.pattern}`
                            });
                    } else {
                        this._server.defineHandler({
                                ...endpoint,
                                path: `/plugin/${name}/${endpoint.path}`
                            });
                    }
                });
                
            return this._plugins[name] = plugin;
        } else {
            throw `${name} is not a pi-deck plugin`;
        }
    }

    async unloadPlugin(name) {
        Application.logger.info('Application', `unloading plugin [${name}]`);
        
        const plugin = this._plugins[name];
        if (!plugin) {
            throw `${name} plugin is not loaded`;
        }

        await plugin.deactivate();
        await plugin.cleanup();
        plugin.endpoints.forEach(endpoint => {
                this._server.removeHandler({
                        ...endpoint,
                        path: `/plugin/${name}/${endpoint.path}`
                    });
            });
    }
    
    async loadPlugins(pluginList) {
        if (!Array.isArray(pluginList))
            throw new Error('pluginList must be of type: Array');

        await Promise.allSettled(pluginList.map(name => this.loadPlugin(name)))
            .then(results => {
                results.forEach(result => {
                        if (result.status === 'rejected')
                            Application.logger.error('Application', result.reason)
                        else
                            this._plugins[result.value.name] = result.value;
                    });
            });

        return this._plugins;
    }

    async unloadPlugins(pluginList) {
        if (!Array.isArray(pluginList))
            throw new Error('pluginList must be of type: Array');

        Object.values(pluginList).forEach(name => {
                this.unloadPlugin(name);
            });
    }
}


module.exports = {
    Application
};
