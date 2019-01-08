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
      .tap(() => this.logger.debug('running pre-instantiation hook'))
      .call('preInstantiation')
      .tap(() => this.logger.debug('instantiating modules'))
      .call('instantiateModules')
      .tap(() => this.logger.debug('running post-instantiation hook'))
      .call('postInstantiation')
      .tap(() => this.logger.debug('running pre-initialization hook'))
      .call('preInitialization')
      .tap(() => this.logger.debug('initializing modules'))
      .call('initializeModules')
      .tap(() => this.logger.debug('running post-initializing hook'))
      .call('postInitialization')
      .tap(() => this.logger.debug('running pre-registration hook'))
      .call('preRegistration')
      .tap(() => this.logger.debug('registering handlers'))
      .call('registerHandlers')
      .tap(() => this.logger.debug('registering sources'))
      .call('registerSources')
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


  preInstantiation() { return this; }
  instantiateModules() {
    this.modules = _.chain(this.config.modules)
      .omitBy({enabled: false})
      .mapValues((v, k) => {
        try {
          const mod = this._loadModule(v.module);
          const courier = v.namespace ? this.courier.registerNamespace(v.namespace) : this.courier;

          if(v.method) {
            if(!_.has(mod, v.method) || !_.isFunction(_.get(mod, v.method))) throw new Error(`Invalid method "${cong.method}"`);
            return _.invoke(mod, v.method, v.config, courier, this);
          }
          return mod(v.config, courier, this);
        }
        catch(err) {
          err.message += ` for module "${k}"`;
          throw err;
        }
      })
      .value();

    return this;
  }
  postInstantiation() { return this; }
  preInitialization() { return this; }
  initializeModules() { return this._invokeModulesMethod('initialize'); }
  postInitialization() { return this; }
  preRegistration() { return this; }
  registerHandlers() { return this._invokeModulesMethod('registerHandlers'); }
  registerSources() { return this._invokeModulesMethod('registerSources'); }
  postRegistration() { return this; }
  terminate() {
    this.logger.info('terminating');
    return this._invokeModulesMethod('terminate');
  }

  _loadModule(id) {
    if(this.loadableModules && this.loadableModules[id]) return this.loadableModules[id];
    if(/^[a-zA-Z_]/.test(id)) return require(id);
    if(_.startsWith(id, '/')) return require(id);
    return require(appRoot+'/'+id);
  }
  _invokeModulesMethod(method, args=[]) {
    return Promise.props(_.mapValues(_.pickBy(this.modules, method), v => v[method].apply(v, args))).return(this);
  }
}


module.exports = Service;
