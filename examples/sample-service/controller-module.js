'use strict';

const _ = require('lodash');

module.exports = function(config, courier, service) {
  courier.reply('ping', (ctx, data) => ({result: 'pong'}));
  courier.reply('time', (ctx, data) => ({result: new Date().toISOString()}));
  courier.reply('sum', (ctx, data) => ({result: _.sum(data.args)}));
}
