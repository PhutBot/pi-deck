var assert = require('assert');
const CorePlugin = require('../../../src/plugins/core/plugin');



describe('CorePlugin', function() {
  describe('#constructor()', function() {
    it('should construct a valid CorePlugin object', function() {
      const core = new CorePlugin();
      assert(core.target === 'pi-deck');
      assert(core.type === 'plugin');
      assert(core.name === 'core');
      assert(core.version === '0.0.1');
      assert(core.description === 'The core plugin for the PiDeck.');
      assert(core.author === 'Caleb French');

      assert(typeof core._overlays === 'object');
      assert(core._enableOverlayCache === false);
      
      assert(this.logger !== null);
    });
  });
  
  describe('#init()', function() {
    it('does not throw', function(done) {
      const core = new CorePlugin();
      core.init()
        .then(done)
        .catch(done);
    });
  });
  
  describe('#cleanup()', function() {
      const core = new CorePlugin();
      core.init()
        .then(() => {
          it('does not throw', function(done) {
            core.cleanup()
              .then(done)
              .catch(done);
          });
        });
  });
  
  describe('#activate()', function() {
    const core = new CorePlugin();
    it('does not throw', function(done) {
      core.init()
        .then(() => {
          core.activate()
            .then(done)
            .catch(done);
        });
    });
  });
  
  describe('#deactivate()', function() {
    const core = new CorePlugin();
    it('does not throw', function(done) {
      core.init()
        .then(() => core.activate())
        .then(() => {
            core.deactivate()
              .then(done)
              .catch(done);
        });
    });
  });
  
  describe('#execute(op, body)', function() {
    it('does not throw', function(done) {
      const core = new CorePlugin();
      core.deactivate()
        .then(done)
        .catch(done);
    });
  });
  
  describe('#opertations()', function() {
    const validOperations = [ 'log' ];
    const core = new CorePlugin();
    
    Object.keys(core.operations).forEach(op => {
      it(`'${op}' is an expected operation`, function() {
        assert(validOperations.includes(op));
      });
    });
  });
  
  describe('#endpoint()', function() {
    const validPaths = [ 'health', 'overlays/*', 'tools/*' ];
    const core = new CorePlugin();
    
    const validMethods = [ 'GET' ];
    core.endpoints.forEach(endpoint => {
      const name = endpoint.path || endpoint.pattern;
      it(`'${name}' endpoint has a valid method`, function() {
        assert(validMethods.includes(endpoint.method));
      });

      it(`'${name}' endpoint has a valid path`, function() {
        assert(name.trim() !== '');
        assert(validPaths.includes(name));
      });
          
      it(`'${name}' endpoint has a valid handler`, function() {
        assert(endpoint.handler.constructor.name === 'AsyncFunction');
      });
    });
  });
  
  describe('#log({ msg })', function() {
    it('does not throw', function(done) {
      const core = new CorePlugin();
      core.log({ msg: 'testing' })
        .then(done)
        .catch(done);
    });
  });
});
  