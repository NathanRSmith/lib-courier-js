'use strict';

const _ = require('lodash');

class Module {
  constructor(config, courier, service) {
    this.config = config;
    this.courier = courier;
    this.service = service;
  }
  registerHandlers() {

    this.courier.reply(this.config.name || 'service:info', () => this.service.courier.network.toJSON());
  }
}

module.exports = function(config, courier, service) {
  return new Module(config, courier, service);
}
