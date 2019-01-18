'use strict';

const assert = require('assert');

const Courier = require('../lib/courier');

module.exports = {

  'pub-sub': {

    'should distribute event to listener': function(done) {
      var courier = new Courier();
      let ct = 0, target = 2;
      function doneMaybe() {
        if(++ct === target) done();
      }

      courier.on('test', (ctx, data) => {
        assert.equal(data, 'hi there');
        doneMaybe();
      });

      courier.emit({}, 'test', 'hi there');
      courier.emit({}, 'test', 'hi there');
    },

    'should distribute event to listeners': function(done) {
      var courier = new Courier();
      let ct = 0, target = 2;
      function doneMaybe() {
        if(++ct === target) done();
      }

      courier.on('test', (ctx, data) => {
        assert.equal(data, 'hi there');
        doneMaybe();
      });
      courier.on('test', (ctx, data) => {
        assert.equal(data, 'hi there');
        doneMaybe();
      });

      courier.emit({}, 'test', 'hi there');
    },

    'should distribute event to listener once': function(done) {
      var courier = new Courier();
      let ct = 0;
      courier.once('test', (ctx, data) => {
        assert.equal(data, 'hi there');
        ct++;
      });
      courier.on('done', () => {
        assert.equal(ct, 1);
        done()
      });

      courier.emit({}, 'test', 'hi there');
      courier.emit({}, 'test', 'hi there');
      courier.emit({}, 'done');
    },

    'should distribute event to pattern listener': function(done) {
      var courier = new Courier();
      let hi = false, hey = false;

      courier.onPattern('test.*', (ctx, name, data) => {
        if(name === 'test-hi') hi = true;
        else if(name === 'test-hey') hey = true;
      });
      courier.once('done', () => {
        assert(hi, 'missing "hi" pattern');
        assert(hey, 'missing "hey" pattern');
        done()
      });

      courier.emit({}, 'test-hi', 'hi there');
      courier.emit({}, 'test-hey', 'hey there');
      courier.emit({}, 'done');
    },

    'should prepend namespace': function(done) {
      var child = new Courier();
      var parent = new Courier();
      let ct = 0, target = 3;
      function doneMaybe() {
        if(++ct === target) done();
      }

      child.on('test', function(ctx, data) {
        assert.equal(data, 'hi there');
        doneMaybe();
      });
      parent.on('BLAH:test', function(ctx, data) {
        assert.equal(data, 'hi there');
        doneMaybe();
      });
      child.on('BLAH:test', function(ctx, data) {
        assert.equal(data, 'hi there');
        doneMaybe();
      });

      parent.registerNamespace('BLAH:', child);
      child.emit({}, 'test', 'hi there');
    },

  }

}
