'use strict';

const _ = require('lodash');

class Controller {
  constructor(config, courier, service) {
    this.config = config;
    this.courier = courier;
    this.service = service;
  }
  registerHandlers() {
    _.each(this.config, (v, k) => {
      this.service.courier.reply(k, (ctx, data) => v);
    });
  }
}

module.exports = function(config, courier, service) {
  return new Controller(config, courier, service);
}
