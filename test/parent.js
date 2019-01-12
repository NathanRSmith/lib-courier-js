'use strict';

const assert = require('assert');

const Courier = require('../lib/courier');

module.exports = {

  'should register a parent': function() {
    var c1 = new Courier();
    var c2 = new Courier();

    c2.reply('test', function(ctx, data) {
      assert.equal(data, 'hi');
      return data.toUpperCase();
    });

    c1.registerParent('', c2);
    return c1.request({}, 'test', 'hi')
      .then(() => c1.request({}, 'test', 'hi'))
      .then(res => assert.equal(res, 'HI'));
  },

  'should throw if parent already registered': function() {
    var c1 = new Courier();
    var c2 = new Courier();
    var c3 = new Courier();

    c1.registerParent('BLAH:', c2);
    assert.throws(c1.registerParent.bind(c1, 'BLAH:', c3), err => {
      assert.equal(err.message, 'Parent already registered');
      return true;
    });
  },

}
