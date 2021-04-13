'use strict';

const _ = require('lodash');

const CONFIG_SCHEMA = {
  "properties": {}
};

class Module {
  constructor(config, courier, service) {
    this.config = config;
    this.courier = courier;
    this.service = service;
  }
  registerHandlers() {
    this.courier.reply('info', () => this.service.toJSON());
    this.courier.reply('config', () => ({
      config: this.service.config,
      modules: _.map(this.service.modules, v => {
        const out = _.pick(v, 'id', 'group');
        if(v.module.config) {
          try {
            out.config = JSON.parse(JSON.stringify(v.module.config));
          }
          catch(err) {
            out.error = err;
          }
        }
        return out;
      })
    }));
  }
}
Module.CONFIG_SCHEMA = CONFIG_SCHEMA;

module.exports = function(config, courier, service) {
  return new Module(config, courier, service);
}
