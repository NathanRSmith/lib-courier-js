'use strict';

const _ = require('lodash');

const CONFIG_SCHEMA = {
  "patternProperties": {
    ".*": {
      "description": "Request name mapping to reply data"
      "type": "object"
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
    _.each(this.config, (v, k) => {
      this.courier.reply(k, (ctx, data) => {
        this.service.logger.info(k, data)
        return v;
      });
    });
  }
}
Module.CONFIG_SCHEMA = CONFIG_SCHEMA;

module.exports = function(config, courier, service) {
  return new Module(config, courier, service);
}
