'use strict';

const _ = require('lodash');
const Promise = require('bluebird');
const appRoot = require('app-root-path');
const Ajv = require('ajv');
const ajv = new Ajv();

const Courier = require('../courier');

class Service {
  constructor() {}
  initialize(opts) {
    this.config = opts.config;
    this.logger = opts.logger;
    this.courier = opts.courier || new Courier();
    this.modules = opts.modules || {};

    return Promise.resolve(this)
      .call('validateConfig')
      .call('preRegistration')
      .call('registerRequestHandlers')
      .call('registerRequestSources')
      // .call('registerEventHandlers')
      // .call('registerEventSources')
      // .call('registerPushHandlers')
      // .call('registerPullSources')
      .call('postRegistration')
      .return(this);
  }
  validateConfig() {
    const valid = ajv.validate(schema, data);
    if(!valid) throw ajv.errors[0] || new Error('Invalid schema provided');
    return this;
  }
  createChildLogger(data) {
    return this.logger.child(data);
  }

  preRegistration() { return this; }
  registerRequestHandlers() {
    if(!_.has(this.config, 'reqrep.handlers')) return this;
    const handlers = this._initializeModules(this.config.reqrep.handlers);
    return Promise.props(handlers).return(this);
  }
  registerRequestSources() {
    if(!_.has(this.config, 'reqrep.sources')) return this;
    const sources = this._initializeModules(this.config.reqrep.sources);
    return Promise.props(sources).return(this);
  }
  registerEventHandlers() { throw new Error('Not Implemented'); }
  registerEventSources() { throw new Error('Not Implemented'); }
  registerPushHandlers() { throw new Error('Not Implemented'); }
  registerPullSources() { throw new Error('Not Implemented'); }
  postRegistration() { return this; }




  _loadModule(id) {
    if(this.modules && this.modules[id]) return this.modules[id];
    if(/^[a-zA-Z_]/.test(id)) return require(id);
    if(_.startsWith(id, '/')) return require(id);
    return require(appRoot+'/'+id);
  }
  _initializeModule(conf, key) {
    const courier = conf.namespace ? this.courier.registerNamespace(conf.namespace) : this.courier;

    if(conf.method) {
      if(!_.has(mod, conf.method) || !_.isFunction(_.get(mod, conf.method))) throw new Error(`Invalid method "${cong.method}" for module "${key}"`);
      return _.invoke(mod, conf.method, conf.config, courier, this);
    }
    return mod(conf.config, courier, this);
  }
  _initializeModules(confs) {
    return _.reduce(confs, (a, v, k) => {
      if(v.enabled === false) return a;
      const mod = this._loadModule(v.module);
      a[k] = this._initializeModule(mod, v, k);
      return a;
    }, {});
  }

}


module.exports = Service;
