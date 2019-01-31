'use strict';

const _ = require('lodash');
const Promise = require('bluebird');
const uuid = require('uuid/v4');
const DataManager = require('./data-manager');

const Network = require('./network');
const GLOBAL_NETWORK = new Network({id: 'GLOBAL'});



class Courier {
  constructor(opts={}) {
    this.id = opts.id || uuid();
    this.name = opts.name;
    this._repHandlers = {};
    this._repPatternHandlers = {};
    this._evtHandlers = {};
    this._evtPatternHandlers = {};
    this._namespaces = {};
    this._reqs = new DataManager();
    this._evts = new DataManager();

    this.network = opts.network || GLOBAL_NETWORK;
    this.network.registerCourier(this);
  }
  toJSON() {
    const obj = {id: this.id, name: this.name};
    if(_.size(this._namespaces)) obj.namespaces = this._namespaces;
    if(_.size(this._repHandlers)) obj.reply = _.mapValues(this._repHandlers, v => _.pick(v, 'calls', 'lastCalled'));
    if(_.size(this._repPatternHandlers)) obj.replyPattern = _.mapValues(this._repPatternHandlers, v => _.pick(v, 'calls', 'lastCalled'));
    if(_.size(this._evtHandlers)) obj.event = _.mapValues(this._evtHandlers, v => _.map(v, v => _.pick(v, 'calls', 'lastCalled', 'once')));
    if(_.size(this._evtPatternHandlers)) obj.eventPatterns = _.mapValues(this._evtPatternHandlers, v => _.map(v.handlers, v => _.pick(v, 'calls', 'lastCalled', 'once')));
    if(_.size(this._reqs.keys())) obj.requests = this._reqs.toJSON();
    if(_.size(this._evts.keys())) obj.events = this._evts.toJSON();
    return obj;
  }
  createContext() {
    return Reflect.construct(Context, arguments);
  }
  // ctx() { return this.createContext.apply(this, arguments); }
  registerNamespace(prefix, courier, opts={}) {
    if(!opts.override && this._namespaces[prefix]) throw new Error(`Namespace already registered for "${prefix}"`);

    if(!courier) courier = new Courier(_.extend({}, opts.courierOpts, {network: this.network}));
    this.network.registerNamespace(prefix, courier, this, opts);
    this._namespaces[prefix] = courier.id;

    return courier;
  }

  request(ctx, name, data, cb) {
    let handlerNode;
    this._reqs.inc([name, 'calls']).set([name, 'lastCalled'], Date.now());
    try {
      handlerNode = this.network.findRequestHandler(name, this.id);
    }
    catch(err) {
      if(cb) return cb(err);
      return Promise.reject(err);
    }

    handlerNode.handler.calls++;
    handlerNode.handler.lastCalled = Date.now();

    let args;
    if(handlerNode.handler.regex) args = [ctx, handlerNode.name, data];
    else args = [ctx, data];

    if(cb) return handlerNode.handler.handler.apply(null, args).asCallback(cb);
    return handlerNode.handler.handler.apply(null, args);
  }
  req() { return this.request.apply(this, arguments); }
  findRequestHandler(name) {
    return this._repHandlers[name] || this._findRepPatternHandler(name);
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

  findEventHandlers(name) {
    return (this._evtHandlers[name] || []).concat(this._findEvtPatternHandlers(name));
  }
  _findEvtPatternHandlers(name) {
    if(!_.size(this._evtPatternHandlers)) return [];
    return _.chain(this._evtPatternHandlers)
      .filter(v => name.search(v.regex) !== -1)
      .map('handlers')
      .flatten()
      .value();
  }

  // emit
  emit(ctx, name, data) {
    this._evts.inc([name, 'calls']).set([name, 'lastCalled'], Date.now());
    try {
      const handlerNodes = this.network.findEventHandlers(name, this.id);
      const now = Date.now();
      _.each(handlerNodes, v => {
        v.handler.calls++;
        v.handler.lastCalled = now;

        let args;
        if(v.handler.regex) args = [ctx, v.name, data];
        else args = [ctx, data];

        if(v.handler.once) v.courier._off(v.name, v.handler.handler);
        v.handler.handler.apply(null, args);
      })
    }
    // TODO: optional logging or error handler?
    catch (err) {
      throw err;
    }
  }

  on(name, handler, opts={}) {
    if(!_.size(this._evtHandlers[name])) this._evtHandlers[name] = [];

    this._evtHandlers[name].push({
      handler,
      calls: 0,
      lastCalled: null,
      once: opts.once
    });
    return this;
  }

  onPattern(pattern, handler) {
    if(!this._evtPatternHandlers[pattern]) {
      this._evtPatternHandlers[pattern] = {
        handlers: [],
        regex: RegExp(pattern)
      };
    }

    this._evtPatternHandlers[pattern].handlers.push({
      handler,
      regex: this._evtPatternHandlers[pattern].regex,
      calls: 0,
      lastCalled: null
    });

    return this;
  }

  once(name, handler, opts={}) {
    return this.on(name, handler, _.extend({}, opts, {once: true}))
    // if(!_.size(this._evtHandlers[name])) this._evtHandlers[name] = [];
    //
    // this._evtHandlers[name].push({
    //   handler: (...args) => {
    //     this._off(name, handler);
    //     handler.apply(null, args);
    //   },
    //   calls: 0,
    //   once: true,
    //   lastCalled: null
    // });
    // return this;
  }
  _off(name, handler) {
    if(!name) _.each(_.keys(this._evtHandlers), k => this._off(k));
    if(!this._evtHandlers[name]) return this;

    if(handler) {
      const idx = _.find(this._evtHandlers[name], v => v.handler === handler);
      if(idx !== -1) this._evtHandlers[name].splice(idx, 1);
    }
    else delete this._evtHandlers[name];

    return this;
  }

  // push
  // pull
}

class Context {
  constructor(data={}, opts={}) {
    this.data = new DataManager(data);
    this.opts = opts;
    this._childIdx = 0;

    this.created_at = Date.now();
    this.id = opts.id ? opts.id.toString() : uuid();
    this.logger = opts.logger;
    if(opts.scope_logger) this.scopeLogger();
    if(opts.exp) this.exp = opts.exp;
    else if(opts.ttl) this.exp = Date.now() + opts.ttl;
  }
  child(padding=0) {
    return new Context(
      this.data.toJSON(),
      _.extend({}, this.opts, {
        id: this.id+'.'+this._childIdx++,
        exp: this.exp ? this.exp - padding : undefined
      })
    );
  }
  scopeLogger() {
    const defaults = {};
    defaults[this.opts.logger_id_field || 'ctx_id'] = this.id;
    this.logger = this.logger.child(defaults);
  }
  isExpired() {
    if(!this.exp) return false;
    return Date.now() >= this.exp;
  }
  get() { return this.data.get.apply(this.data, arguments); }
  set() { return this.data.set.apply(this.data, arguments); }
  unset() { return this.data.unset.apply(this.data, arguments); }
}

module.exports = Courier;
module.exports.Network = Network;
module.exports.Courier = Courier;
module.exports.Context = Context;
