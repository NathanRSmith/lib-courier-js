'use strict';

const assert = require('assert');

const Courier = require('../lib/courier');

module.exports = {

  'request-reply': {

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

      courier.reply('test', function(ctx, data) {
        assert.equal(data, 'hi');
        throw new Error('custom fail');
      });

      courier.request({}, 'test', 'hi', err => {
        assert.equal(err.message, 'custom fail');
        done();
      });
    },

    'should throw if handler throws': function() {
      var courier = new Courier();

      courier.reply('test', function(ctx, data) {
        assert.equal(data, 'hi');
        throw new Error('custom fail');
      });

      courier.request({}, 'test', 'hi')
        .then(() => { throw new Error('should not reach here'); })
        .catch(err => assert.equal(err.message, 'custom fail'));
    },

    'should return handler response (cb)': function(done) {
      var courier = new Courier();

      courier.reply('test', function(ctx, data) {
        assert.equal(data, 'hi there');
        return data.split('').reverse().join('');
      });

      courier.request({}, 'test', 'hi there', (err, rep) => {
        assert(!err);
        assert.equal(rep, 'ereht ih');
        done();
      });
    },

    'should return handler response': function() {
      var courier = new Courier();

      courier.reply('test', function(ctx, data) {
        assert.equal(data, 'hi there');
        return data.split('').reverse().join('');
      });

      courier.request({}, 'test', 'hi there')
        .then(rep => assert.equal(rep, 'ereht ih'));
    },

    'should pattern handler response': function() {
      var courier = new Courier();

      courier.replyPattern('test.*', (ctx, name, data) => {
        assert.equal(name, 'testblah');
        assert.equal(data, 'req 2');
        return 'rep 2';
      });
      courier.reply('testtest', (ctx, data) => {
        assert.equal(data, 'req 1');
        return 'rep 1';
      });

      courier.request({}, 'testtest', 'req 1')
        .then(res => assert.equal(res, 'rep 1'))
        .then(() => courier.request({}, 'testblah', 'req 2'))
        .then(res => assert.equal(res, 'rep 2'));
    },

    'should prefer name to pattern': function() {
      var c1 = new Courier();
      var c2 = new Courier();

      c1.registerNamespace('test:', c2);

      c2.replyPattern('^hi-.*', (ctx, name, data) => {
        assert.equal(data, '1');
        return '1';
      });

      return c1.request({}, 'test:hi-1', '1')
        .tap(res => assert.equal(res, '1'))
        .tap(() => {
          c2.reply('hi-2', (ctx, data) => {
            assert.equal(data, '2');
            return '2';
          });
        })
        .then(() => c1.request({}, 'test:hi-2', '2'))
        .tap(res => assert.equal(res, '2'));
    },

    'should resolve to new handler on override': function() {
      var c1 = new Courier();
      var c2 = new Courier();

      c1.registerNamespace('test:', c2);

      c2.reply('hi', (ctx, data) => {
        assert.equal(data, '1');
        return '1';
      });

      return c1.request({}, 'test:hi', '1')
        .tap(res => assert.equal(res, '1'))
        .tap(() => {
          c2.reply('hi', (ctx, data) => {
            assert.equal(data, '2');
            return '2';
          }, {override: true});
        })
        .then(() => c1.request({}, 'test:hi', '2'))
        .tap(res => assert.equal(res, '2'));
    },


  }

}
