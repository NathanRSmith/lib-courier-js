'use strict';

const _ = require('lodash');
const Promise = require('bluebird');
const uuid = require('uuid/v4');
const DataManager = require('./data-manager');

class Courier {
  constructor() {
    this._repHandlers = {};
    this._repPatternHandlers = {};
    this._namespaces = {};
  }
  toJSON() {
    const obj = {};
    if(_.size(this._namespaces)) obj.namespaces = _.mapValues(this._namespaces, v => v.courier.toJSON());
    if(_.size(this._repHandlers)) obj.reply = _.mapValues(this._repHandlers, v => _.pick(v, 'calls', 'lastCalled'));
    if(_.size(this._repPatternHandlers)) obj.replyPattern = _.mapValues(this._repPatternHandlers, v => _.pick(v, 'calls', 'lastCalled'));
    return obj;
  }
  createContext() {
    return Reflect.construct(Context, arguments);
  }
  // ctx() { return this.createContext.apply(this, arguments); }
  registerNamespace(prefix, courier, override=false) {
    if(!override && this._namespaces[prefix]) throw new Error(`Namespace already registered for "${prefix}"`);
    if(!courier) courier = new Courier();
    this._namespaces[prefix] = {prefix, courier};
    return courier;
  }
  findNamespace(name) {
    return _.find(this._namespaces, (v, k) => _.startsWith(name, k));
  }
  registerParent(courier, override=false) {
    if(!override && this._parent) throw new Error('Parent already registered');
    if(!courier) throw new Error('Courier argument is required');
    this._parent = courier;
    return this;
  }

  request(ctx, name, data, cb) {
    const handler = this._repHandlers[name] || this._findRepPatternHandler(name);
    if(!handler) {
      const ns = this.findNamespace(name);
      if(ns) {
        return ns.courier.request(ctx, name.slice(ns.prefix.length), data, cb);
      }
      if(this._parent) {
        return this._parent.request(ctx, name, data, cb);
      }
      const err = new Error(`No handler registered for request "${name}"`);
      if(cb) return cb(err);
      return Promise.reject(err);
    }

    handler.calls++;
    handler.lastCalled = Date.now();

    let args;
    if(handler.regex) args = [ctx, name, data];
    else args = [ctx, data];

    if(cb) return handler.handler.apply(null, args).asCallback(cb);
    return handler.handler.apply(null, args);
  }
  _findRepPatternHandler(name) {
    if(!_.size(this._repPatternHandlers)) return;
    return _.find(this._repPatternHandlers, v => name.search(v.regex) !== -1);
  }

  reply(name, handler, override=false) {
    if(!override && this._repHandlers[name]) throw new Error(`Reply handler already registered for "${name}"`);

    this._repHandlers[name] = {
      handler: handler.length === 3 ? Promise.promisify(handler) : Promise.method(handler),
      calls: 0,
      lastCalled: null
    };
    return this;
  }
  replyPattern(pattern, handler, override=false) {
    if(!override && this._repHandlers[pattern]) throw new Error(`Reply pattern handler already registered for "${pattern}"`);

    this._repPatternHandlers[pattern] = {
      handler: handler.length === 4 ? Promise.promisify(handler) : Promise.method(handler),
      regex: RegExp(pattern),
      calls: 0,
      lastCalled: null
    };
    return this;
  }

  // emit
  // on
  // once
  // push
  // pull
}

class Context {
  constructor(logger, id, exp, data) {
    this._childIdx = 0;
    this.data = new DataManager();
    this.logger = logger;
    this.id = id ? id.toString() : uuid();
    this.exp = exp;
    this.created_at = Date.now();
    if(data) this.data.set(data);
  }
  child(padding=0) {
    return new Context(
      this.logger,
      this.id+'.'+this._childIdx++,
      this.exp ? this.exp - padding : undefined
    );
  }
  isExpired() {
    if(!this.exp) return false;
    return Date.now() >= this.exp;
  }
  get() {
    return this.data.get.apply(this.data, arguments);
  }
}

module.exports = Courier;
module.exports.Courier = Courier;
module.exports.Context = Context;
