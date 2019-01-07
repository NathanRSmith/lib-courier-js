'use strict';

const _ = require('lodash');
const Promise = require('bluebird');
const appRoot = require('app-root-path');
const Ajv = require('ajv');
const ajv = new Ajv();

const SCHEMA = require('./schema.json');
const Courier = require('../courier');

class Service {
  constructor() {
    this.schema = SCHEMA;
  }
  initialize(opts) {
    this.config = opts.config;
    this.logger = opts.logger;
    this.courier = opts.courier || new Courier();
    this.loadableModules = opts.loadableModules || {};
    this.modules = {};

    return Promise.resolve(this)
      .tap(() => this.logger.debug('validating config'))
      .call('validateConfig')
      .tap(() => this.logger.debug('running pre-registration hook'))
      .call('preRegistration')
      .tap(() => this.logger.debug('registering request handlers'))
      .call('registerRequestHandlers')
      .tap(() => this.logger.debug('registering request sources'))
      .call('registerRequestSources')
      // .call('registerEventHandlers')
      // .call('registerEventSources')
      // .call('registerPushHandlers')
      // .call('registerPullSources')
      .tap(() => this.logger.debug('running post-registration hook'))
      .call('postRegistration')
      .return(this);
  }
  validateConfig() {
    const valid = ajv.validate(this.schema, this.config);
    if(!valid) {
      if(_.first(ajv.errors)) {
        var err = new Error();
        err = _.extend(err, ajv.errors[0]);
        if(err.dataPath) err.message = `Data path "${err.dataPath}" ${err.message}`;
        err.name = 'ConfigurationValidationError';
        throw err;
      }
      throw new Error('Invalid schema provided');
    }
    return this;
  }
  createChildLogger(data) {
    return this.logger.child(data);
  }

  preRegistration() { return this; }
  registerRequestHandlers() {
    if(!_.has(this.config, 'reqrep.handlers')) return this;
    const handlers = this._initializeModules(this.config.reqrep.handlers);
    return Promise.props(handlers)
      .tap(res => this.modules = _.extend(this.modules, res))
      .return(this);
  }
  registerRequestSources() {
    if(!_.has(this.config, 'reqrep.sources')) return this;
    const sources = this._initializeModules(this.config.reqrep.sources);
    return Promise.props(sources)
      .tap(res => this.modules = _.extend(this.modules, res))
      .return(this);
  }
  registerEventHandlers() { throw new Error('Not Implemented'); }
  registerEventSources() { throw new Error('Not Implemented'); }
  registerPushHandlers() { throw new Error('Not Implemented'); }
  registerPullSources() { throw new Error('Not Implemented'); }
  postRegistration() { return this; }




  _loadModule(id) {
    if(this.loadableModules && this.loadableModules[id]) return this.loadableModules[id];
    if(/^[a-zA-Z_]/.test(id)) return require(id);
    if(_.startsWith(id, '/')) return require(id);
    return require(appRoot+'/'+id);
  }
  _initializeModule(mod, conf, key) {
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
