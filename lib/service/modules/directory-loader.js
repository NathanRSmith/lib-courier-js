'use strict';

const fs = require('fs');
const path = require('path');
const _ = require('lodash');

const CONFIG_SCHEMA = {
  "properties": {
    "root": {
      "description": "",
      "type": "string"
    },
    "repliers": {
      "description": "",
      "type": "string",
      "default": "repliers"
    },
    "listeners": {
      "description": "",
      "type": "string",
      "default": "listeners"
    }
  },
  "required": ["root"]
};

const EXTENSIONS = ['js'];
class Module {
  constructor(config, courier, service) {
    this.config = config;
    this.courier = courier;
    this.service = service;
  }
  registerHandlers() {
    this.loadRepliers();
    this.loadListeners();
  }

  loadRepliers() {
    const repliers = this._loadDir(path.join(this.config.root, this.config.repliers || 'repliers'));
    _.each(repliers, (v, k) => {
      if(v.enabled === 'false') return;
      if(v.pattern) this.courier.replyPattern(v.pattern, (v.handler || v).bind(null, this));
      else this.courier.reply(v.name || k, (v.handler || v).bind(null, this));
    });
  }
  loadListeners() {
    const listeners = this._loadDir(path.join(this.config.root, this.config.listeners || 'listeners'));
    _.each(listeners, (v, k) => {
      if(v.enabled === 'false') return;
      if(v.pattern) this.courier.onPattern(v.pattern, (v.handler || v).bind(null, this));
      else this.courier.on(v.name || k, (v.handler || v).bind(null, this));
    });
  }

  _loadDir(dir) {
    try {
      return _.reduce(fs.readdirSync(dir), (a, v) => {
        const ext = _.last(v.split('.'));
        if(!_.includes(EXTENSIONS, ext)) return a;

        const mod = require(path.join(dir, v));
        a[v.slice(0, -(ext.length+1))] = mod;
        return a;
      }, {});
    }
    catch(err) {
      if(err.code !== 'ENOENT') throw err;
    }
  }
}
Module.CONFIG_SCHEMA = CONFIG_SCHEMA;

module.exports = function(config, courier, service) {
  return new Module(config, courier, service);
}
module.exports.Module = Module;
