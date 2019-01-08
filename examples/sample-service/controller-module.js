'use strict';

const _ = require('lodash');

class Controller {
  constructor(config, courier, service) {
    this.config = config;
    this.courier = courier;
    this.service = service;
  }
  registerHandlers() {
    this.courier.reply('ping', (ctx, data) => ({result: 'pong'}));
    this.courier.reply('time', (ctx, data) => ({result: new Date().toISOString()}));
    this.courier.reply('sum', (ctx, data) => ({result: _.sum(data.args)}));
  }
}

module.exports = function(config, courier, service) {
  return new Controller(config, courier, service);
}
