const { Application } = require('./Application');

const app = new Application();
app.loadPlugins([ 'slobs', 'twitch' ]);
app.run();