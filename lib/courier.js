'use strict';

const _ = require('lodash');
const Promise = require('bluebird');
const uuid = require('uuid/v4');
const DataManager = require('./data-manager');

class Courier {
  constructor() {
    this._repHandlers = {};
    this._namespaces = {};
  }
  createContext() {
    return new (Function.prototype.bind.apply(Context, arguments));
  }
  // ctx() { return this.createContext.apply(this, arguments); }
  registerNamespace(prefix, courier, override=false) {
    if(!override && this._namespaces[prefix]) throw new Error(`Namespace already registered for "${prefix}"`);
    if(!courier) courier = new Courier();
    this._namespaces[prefix] = {
      prefix,
      courier: courier
    };
    return courier;
  }
  findNamespace(name) {
    return _.find(this._namespaces, (v, k) => _.startsWith(name, k));
  }
  // hasHandler(name) {
  //   if(this._repHandlers[name]) return true;
  //   const ns = this.findNamespace(name);
  //   if(ns) return
  // }

  request(ctx, name, data, cb) {
    if(!this._repHandlers[name]) {
      const ns = this.findNamespace(name);
      if(ns) {
        return ns.courier.request(ctx, name.slice(ns.prefix.length), data, cb);
      }
      const err = new Error(`No handler registered for request "${name}"`);
      if(cb) return cb(err);
      return Promise.reject(err);
    }

    const handler = this._repHandlers[name];
    handler.calls++;
    handler.lastCalled = Date.now();

    if(cb) return handler.handler(ctx, data).asCallback(cb);
    return handler.handler(ctx, data);
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

  // emit
  // on
  // once
  // push
  // pull
}

class Context {
  constructor(logger, id, exp, data) {
    this._childIdx = 0;
    this._data = new DataManager();
    this.logger = logger;
    this.id = id ? id.toString() : uuid();
    this.exp = exp;
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
}

module.exports = Courier;
module.exports.Courier = Courier;
module.exports.Context = Context;
