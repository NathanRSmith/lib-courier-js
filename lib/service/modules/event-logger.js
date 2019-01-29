'use strict';

const _ = require('lodash');

const CONFIG_SCHEMA = {
  "properties": {
    "events": {
      "description": "Map of event names to logger level",
      "type": "object",
      "patternProperties": {
        ".*": {
          "description": "Logger level to call on service.logger",
          "type": "string",
          "examples": ["fatal", "error", "warn", "info", "debug", "trace"]
        }
      }
    },
    "patterns": {
      "description": "Map of event name patterns to logger level",
      "type": "object",
      "patternProperties": {
        ".*": {
          "description": "Logger level to call on service.logger",
          "type": "string",
          "examples": ["fatal", "error", "warn", "info", "debug", "trace"]
        }
      }
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
    _.each(this.config.events, (v, k) => this.courier.on(k, (ctx, data) => this.service.logger[v](_.extend({event: k, message: `Event "${k}" received`}, data))));
    _.each(this.config.patterns, (v, k) => this.courier.onPattern(k, (ctx, evt, data) => this.service.logger[v](_.extend({event: evt, message: `Event "${evt}" received`}, data))));
  }
}
Module.CONFIG_SCHEMA = CONFIG_SCHEMA;

module.exports = function(config, courier, service) {
  return new Module(config, courier, service);
}
