'use strict';

const _ = require('lodash');
const Promise = require('bluebird');
const uuid = require('uuid/v4');
const DataManager = require('./data-manager');

class Network {
  constructor(opts={}) {
    this.id = opts.id || uuid();
    this.couriers = {};
    this.connections = [];
  }
  toJSON() {
    return {
      id: this.id,
      couriers: _.map(this.couriers),
      connections: this.connections
    };
  }

  registerCourier(courier) {
    if(this.couriers[courier.id]) return this;
    this.couriers[courier.id] = courier;
    return this;
  }
  registerNamespace(prefix, child, parent, opts) {
    if(!this.couriers[child.id]) throw new Error(`Unknown child courier "${child.id}"`);
    if(!this.couriers[parent.id]) throw new Error(`Unknown parent courier "${parent.id}"`);
    if(!opts.override && _.find(this.connections, {from: parent.id, to: child.id, prefix})) {
      throw new Error(`Namespace already registered for "${prefix}"`);
    }

    this.connections.push({from: parent.id, to: child.id, prefix: prefix, retainPrefix: opts.retainPrefix});
    this.checkCycles();
    return this;
  }

  findNamespaces(name, id) {
    return _.filter(this.connections, v => v.from === id && _.startsWith(name, v.prefix));
  }
  findReferrers(id) {
    return _.filter(this.connections, {to: id});
  }

  findRequestHandler(name, id) {
    if(!this.couriers[id]) throw new Error(`Unknown courier "${id}"`);
    const visits = {};
    const q = [{name, id}];
    let current,
        courier,
        handler,
        namespace,
        namespaces,
        referrer,
        referrers;

    while (q.length) {
      current = q.shift();
      if(_.get(visits, [current.id, current.name])) continue;
      _.set(visits, [current.id, current.name], true);

      courier = this.couriers[current.id];
      handler = courier.findRequestHandler(current.name);
      if(handler) return {courier, handler, name: current.name};

      // child namespaces
      _.chain(this.findNamespaces(current.name, current.id))
        .sortBy(v => v.prefix.length)
        .each(v => q.unshift({id: v.to, name: v.retainPrefix ? current.name : current.name.slice(v.prefix.length)}))
        .value();

      // referrers
      _.each(this.findReferrers(current.id), v => q.push({id: v.from, name: current.name}));
    }

    throw new Error(`No handler registered for request "${name}"`);
  }

  findEventHandlers(name, id) {
    if(!this.couriers[id]) throw new Error(`Unknown courier "${id}"`);
    const visits = {};
    const q = [{name, id}];
    let handlers = [],
        current,
        courier,
        nodeHandlers,
        namespace,
        namespaces,
        referrer,
        referrers;

    while (q.length) {
      current = q.shift();
      if(_.get(visits, [current.id, current.name])) continue;
      _.set(visits, [current.id, current.name], true);

      courier = this.couriers[current.id];
      nodeHandlers = courier.findEventHandlers(current.name);
      if(_.size(nodeHandlers)) handlers = handlers.concat(_.map(nodeHandlers, v => ({courier, handler: v, name: current.name})));

      // child namespaces
      _.each(
        this.findNamespaces(current.name, current.id),
        v => q.unshift({id: v.to, name: current.name, down: true})
      );

      // referrers
      if(!current.down) _.each(this.findReferrers(current.id), v => q.push({id: v.from, name: v.prefix+current.name}));
    }

    // throw new Error(`No handler registered for event "${name}"`);
    return handlers;
  }

  // TODO
  checkCycles() {
    return this;
  }
}
const GLOBAL_NETWORK = new Network({id: 'GLOBAL'});

class Courier {
  constructor(opts={}) {
    this.id = opts.id || uuid();
    this._repHandlers = {};
    this._repPatternHandlers = {};
    this._evtHandlers = {};
    this._evtPatternHandlers = {};
    this._namespaces = {};

    this.network = opts.network || GLOBAL_NETWORK;
    this.network.registerCourier(this);
  }
  toJSON() {
    const obj = {id: this.id};
    if(_.size(this._namespaces)) obj.namespaces = this._namespaces;
    if(_.size(this._repHandlers)) obj.reply = _.mapValues(this._repHandlers, v => _.pick(v, 'calls', 'lastCalled'));
    if(_.size(this._repPatternHandlers)) obj.replyPattern = _.mapValues(this._repPatternHandlers, v => _.pick(v, 'calls', 'lastCalled'));
    if(_.size(this._evtHandlers)) obj.sub = _.mapValues(this._evtHandlers, v => _.map(v, v => _.pick(v, 'calls', 'lastCalled', 'once')));
    if(_.size(this._evtPatternHandlers)) obj.sub = _.mapValues(this._evtPatternHandlers, v => _.map(v, v => _.pick(v, 'calls', 'lastCalled', 'once')));
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
      // TODO: clone data
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
module.exports.Network = Network;
module.exports.Courier = Courier;
module.exports.Context = Context;
