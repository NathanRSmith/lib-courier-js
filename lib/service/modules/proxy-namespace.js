'use strict';

class Controller {
  constructor(config, courier, service) {
    this.config = config;
    this.courier = courier;
    this.service = service;
  }
  registerHandlers() {
    this.courier.replyPattern('.*', (ctx, name, data) => {
      return this.service.courier.request(ctx, this.config.prefix+name, data);
    });
  }
}

module.exports = function(config, courier, service) {
  return new Controller(config, courier, service);
}
