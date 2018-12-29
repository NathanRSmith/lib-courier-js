'use strict';

const assert = require('assert');
const _ = require('lodash');
const Promise = require('bluebird');

const Courier = require('../lib/courier');

module.exports = {

  'should throw if handler already registered': function() {
    var courier = new Courier();
    courier.reply('fail', function() {});
    assert.throws(
      courier.reply.bind(courier, 'fail', function() {}),
      err => {
        assert.equal(err.message, 'Reply handler already registered for "fail"');
        return true;
      }
    );
  },

  'should throw if handler not registered (cb)': function(done) {
    var courier = new Courier();

    courier.request({}, 'fail', {}, err => {
      assert.equal(err.message, 'No handler registered for request "fail"');
      done();
    });
  },

  'should throw if handler not registered': function() {
    var courier = new Courier();

    return courier.request({}, 'fail')
      .then(() => { throw new Error('should not reach here'); })
      .catch(err => assert.equal(err.message, 'No handler registered for request "fail"'));
  },

  'should throw if handler throws (cb)': function(done) {
    var courier = new Courier();

    courier.reply('test', function(ctx, args) {
      assert.equal(args, 'hi');
      return Promise.reject(new Error('custom fail'));
    });

    courier.request({}, 'test', 'hi', err => {
      assert.equal(err.message, 'custom fail');
      done();
    });
  },

  'should throw if handler throws': function() {
    var courier = new Courier();

    courier.reply('test', function(ctx, args) {
      assert.equal(args, 'hi');
      throw new Error('custom fail');
    });

    courier.request({}, 'test', 'hi')
      .then(() => { throw new Error('should not reach here'); })
      .catch(err => assert.equal(err.message, 'custom fail'));
  },

  'should return handler response (cb)': function(done) {
    var courier = new Courier();

    courier.reply('test', function(ctx, args) {
      assert.equal(args, 'hi there');
      return args.split('').reverse().join('');
    });

    courier.request({}, 'test', 'hi there', (err, rep) => {
      assert(!err);
      assert.equal(rep, 'ereht ih');
      done();
    });
  },

  'should return handler response': function() {
    var courier = new Courier();

    courier.reply('test', function(ctx, args) {
      assert.equal(args, 'hi there');
      return args.split('').reverse().join('');
    });

    courier.request({}, 'test', 'hi there')
      .then(rep => assert.equal(rep, 'ereht ih'));
  },

}
