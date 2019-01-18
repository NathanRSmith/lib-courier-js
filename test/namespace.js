'use strict';

const assert = require('assert');

const Courier = require('../lib/courier');

module.exports = {

  'should register namespace with existing courier': function() {
    var c1 = new Courier();
    var c2 = new Courier();
    c2.reply('test', function(ctx, data) {
      assert.equal(data, 'hi');
      return data.toUpperCase();
    });

    c1.registerNamespace('BLAH:', c2);

    return c1.request({}, 'test', 'hi')
      .then(() => { throw new Error('should not reach here'); })
      .catch(err => assert.equal(err.message, 'No handler registered for request "test"'))
      .then(() => c1.request({}, 'BLAH:fail', 'hi'))
      .then(() => { throw new Error('should not reach here'); })
      .catch(err => assert.equal(err.message, 'No handler registered for request "BLAH:fail"'))
      .then(() => c1.request({}, 'BLAH:test', 'hi'))
      .then(res => assert.equal(res, 'HI'));
  },

  'should register namespace with new courier': function() {
    var c1 = new Courier();
    var c2 = c1.registerNamespace('BLAH:');

    c2.reply('test', function(ctx, data) {
      assert.equal(data, 'hi');
      return data.toUpperCase();
    });

    return c1.request({}, 'test', 'hi')
      .then(() => { throw new Error('should not reach here'); })
      .catch(err => assert.equal(err.message, 'No handler registered for request "test"'))
      .then(() => c1.request({}, 'BLAH:test', 'hi'))
      .then(res => assert.equal(res, 'HI'));
  },

  'should throw if namespace already registered': function() {
    var c1 = new Courier();
    c1.registerNamespace('BLAH:');
    assert.throws(c1.registerNamespace.bind(c1, 'BLAH:'), err => {
      assert.equal(err.message, 'Namespace already registered for "BLAH:"');
      return true;
    });
  },

  'should override namespace': function() {
    var c1 = new Courier();
    var c2 = new Courier();
    c2.reply('test', function(ctx, data) {
      assert.equal(data, 'hi');
      return data.toUpperCase();
    });

    c1.registerNamespace('BLAH:', c2);
    c1.registerNamespace('BLAH:', c2, {override: true});

    return c1.request({}, 'test', 'hi')
      .then(() => { throw new Error('should not reach here'); })
      .catch(err => assert.equal(err.message, 'No handler registered for request "test"'))
      .then(() => c1.request({}, 'BLAH:test', 'hi'))
      .then(res => assert.equal(res, 'HI'));
  },

  'should retain the prefix if specified': function() {
    var c1 = new Courier();
    var c2 = new Courier();
    c2.reply('BLAH:test', function(ctx, data) {
      assert.equal(data, 'hi');
      return data.toUpperCase();
    });

    c1.registerNamespace('BLAH:', c2, {retainPrefix: true});

    return c1.request({}, 'test', 'hi')
      .then(() => { throw new Error('should not reach here'); })
      .catch(err => assert.equal(err.message, 'No handler registered for request "test"'))
      .then(() => c1.request({}, 'BLAH:test', 'hi'))
      .then(res => assert.equal(res, 'HI'));
  },

  'should prevent cycles': function() {
    var child = new Courier();
    var parent = new Courier();

    parent.reply('test', function(ctx, data) {
      assert.equal(data, 'hi');
      return data.toUpperCase();
    });

    parent.registerNamespace('BLAH:', child, {retainPrefix: true});
    return child.request({}, 'BLAH:test', 'hi')
      .then(() => { throw new Error('should not reach here'); })
      .catch(err => assert.equal(err.message, 'No handler registered for request "BLAH:test"'));
  },

}
