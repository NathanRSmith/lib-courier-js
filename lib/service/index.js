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
    this.created_at = Date.now();
  }
  toJSON() {
    const res = _.pick(this.courier.network.toJSON(), 'couriers', 'connections');
    res.name = this.config.name;
    res.created_at = this.created_at;
    res.uptime = Date.now() - this.created_at;
    res.modules = _.map(this.modules, v => ({id: v.id, group: v.group, courier: v.courier.id}));
    return res;
  }

  initialize(opts) {
    this.config = opts.config;
    this.logger = opts.logger;
    this.courier = opts.courier || new Courier();
    this.require = opts.require;
    this.loadableModules = opts.loadableModules || {};
    this.modules = [];

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


  preInstantiation() { return this; }
  instantiateModules() {

    const instantiateGroup = (config, courier, group=[]) => {
      this.modules = _.chain(config.modules)
        .omitBy({enabled: false})
        .map((v, k) => {
          try {
            const mod = this._loadModule(v.module);

            let _courier = courier;
            // set up namespace & aliases (reuse first ns courier)
            if(v.namespace || v.namespaces) {
              const ns = _.chain(v.namespace).concat(v.namespaces).filter().uniq().value();
              const retainPrefix = v.retainPrefix;
              _courier = _.reduce(ns.slice(1), (a, v) => {
                return courier.registerNamespace(v, a, {retainPrefix});
              }, courier.registerNamespace(ns[0], null, {courierOpts: {name: v.name || k}, retainPrefix}));
            }

            this.logger.info(`instantiating module "${k}" for group "${group}"`);

            v.config = _.extend({_module: {
              group: group.length && group,
              id: k
            }}, v.config);

            if(v.method) {
              if(!_.has(mod, v.method) || !_.isFunction(_.get(mod, v.method))) throw new Error(`Invalid method "${cong.method}"`);
              return {id: k, group, courier: _courier, module: _.invoke(mod, v.method, v.config, _courier, this)};
            }
            return {id: k, group, courier: _courier, module: mod(v.config, _courier, this)};
          }
          catch(err) {
            err.message += ` (module "${k}")`;
            throw err;
          }
        })
        .concat(this.modules)
        .value();

      _.each(_.omitBy(config.groups, {enabled: false}), (v, k) => {
        let _courier = courier;
        // set up namespace & aliases (reuse first ns courier)
        if(v.namespace || v.namespaces) {
          const ns = _.chain(v.namespace).concat(v.namespaces).filter().uniq().value();
          const retainPrefix = v.retainPrefix
          _courier = _.reduce(ns.slice(1), (a, v) => {
            return courier.registerNamespace(v, a, {retainPrefix});
          }, courier.registerNamespace(ns[0], null, {courierOpts: {name: v.name || k}, retainPrefix}));
        }

        instantiateGroup(v, _courier, _.concat(group, k));
      });
    }

    instantiateGroup(this.config, this.courier, []);
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
    if(this.logger) this.logger.info('terminating');
    return this._invokeModulesMethod('terminate');
  }

  _loadModule(id) {
    if(this.loadableModules && this.loadableModules[id]) return this.loadableModules[id];
    if(this.require) return this.require(id);

    let _require = require;
    // if(this._requirePath) _require = createRequireFromPath(this._requirePath);
    if(/^[a-zA-Z_]/.test(id)) return _require(id);
    if(_.startsWith(id, '/')) return _require(id);

    // if(this._requirePath) return _require(id);
    return _require(appRoot+'/'+id);
  }
  _invokeModulesMethod(method, args=[]) {
    return Promise.all(_.map(_.filter(this.modules, v => v.module[method]), v => {
      this.logger.info(`running method "${method}" on module "${v.id}"${v.group ? ` in group "${v.group}"` : ''}`);
      return v.module[method].apply(v.module, args);
    })).return(this);
  }
}


module.exports = Service;
