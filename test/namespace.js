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

    c1.createNamespace('BLAH:', c2);

    return c1.request({}, 'test', 'hi')
      .then(() => { throw new Error('should not reach here'); })
      .catch(err => assert.equal(err.message, 'No handler registered for request "test"'))
      .then(() => c1.request({}, 'BLAH:test', 'hi'))
      .then(res => assert.equal(res, 'HI'));
  },

  'should register namespace with new courier': function() {
    var c1 = new Courier();
    var c2 = c1.createNamespace('BLAH:');

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
    c1.createNamespace('BLAH:');
    assert.throws(c1.createNamespace.bind(c1, 'BLAH:'), err => {
      assert.equal(err.message, 'Namespace already registered for "BLAH:"');
      return true;
    });
  },

}
