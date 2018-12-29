'use strict';

const _ = require('lodash');
const Promise = require('bluebird');
const uuid = require('uuid/v4');
const DataManager = require('./data-manager');

class Courier {
  constructor() {
    this._repHandlers = {};
  }
  createContext() {
    return new (Function.prototype.bind.apply(Context, arguments));
  }

  request(ctx, name, args, cb) {
    if(!this._repHandlers[name]) {
      const err = new Error(`No handler registered for request "${name}"`);
      if(cb) return cb(err);
      return Promise.reject(err);
    }

    const handler = this._repHandlers[name];
    handler.calls++;
    handler.lastCalled = Date.now();

    if(cb) return handler.handler(ctx, args).asCallback(cb);
    return handler.handler(ctx, args);
  }

  // NOTE: handler needs to be real fn, not arrow
  reply(name, handler, override=false) {
    if(!override && this._repHandlers[name]) throw new Error(`Reply handler already registered for "${name}"`);
    const hasCb = handler.prototype.length === 3;
    this._repHandlers[name] = {
      handler: hasCb ? Promise.promisify(handler) : Promise.method(handler),
      calls: 0,
      lastCalled: null
    };
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
