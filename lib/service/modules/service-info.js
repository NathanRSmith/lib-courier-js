'use strict';

const _ = require('lodash');

const CONFIG_SCHEMA = {
  "properties": {
    "name": {
      "description": "Request name to reply to",
      "type": "string", 
      "default": "service:info"
    }
  }
};

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
Module.CONFIG_SCHEMA = CONFIG_SCHEMA;

module.exports = function(config, courier, service) {
  return new Module(config, courier, service);
}
