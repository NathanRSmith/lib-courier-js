'use strict';

const _ = require('lodash');
const uuid = require('uuid/v4');

class Network {
  constructor(opts={}) {
    this.id = opts.id || uuid();
    this.couriers = {};
    this.connections = [];
    this._reqcache = {};
    this._evtcache = {};
  }
  toJSON() {
    return {
      id: this.id,
      couriers: _.invokeMap(this.couriers, 'toJSON'),
      connections: this.connections
    };
  }
  invalidateCache() {
    this._reqcache = {};
    this._evtcache = {};
    return this;
  }

  registerCourier(courier) {
    if(this.couriers[courier.id]) return this;
    this.couriers[courier.id] = courier;
    return this;
  }
  registerNamespace(prefix, target, source, opts) {
    if(!this.couriers[target.id]) throw new Error(`Unknown target courier "${target.id}"`);
    if(!this.couriers[source.id]) throw new Error(`Unknown source courier "${source.id}"`);
    if(!opts.override && _.find(this.connections, {from: source.id, to: target.id, prefix})) {
      throw new Error(`Namespace already registered for "${prefix}"`);
    }

    this.connections.push({from: source.id, to: target.id, prefix: prefix, retainPrefix: opts.retainPrefix});
    this.checkCycles();
    return this;
  }

  findNamespaces(name, id) {
    return _.filter(this.connections, v => v.from === id && _.startsWith(name, v.prefix));
  }
  findReferred(id) {
    return _.filter(this.connections, {from: id});
  }
  findReferrers(id) {
    return _.filter(this.connections, {to: id});
  }

  // TODO: optimizable via caching per node
  findRequestHandler(name, id) {
    if(!this.couriers[id]) throw new Error(`Unknown courier "${id}"`);
    if(_.has(this._reqcache, [id, name])) return _.get(this._reqcache, [id, name]);
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
      if(handler) {
        _.set(this._reqcache, [id, name], {courier, handler, name: current.name});
        return {courier, handler, name: current.name};
      }

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

  // TODO: optimizable via caching per node
  findEventHandlers(name, id) {
    if(!this.couriers[id]) throw new Error(`Unknown courier "${id}"`);
    if(_.has(this._evtcache, [id, name])) return _.get(this._evtcache, [id, name]);
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
        this.findReferred(current.id),
        v => q.unshift({id: v.to, name: current.name, down: true})
      );

      // referrers
      if(!current.down) _.each(this.findReferrers(current.id), v => q.push({id: v.from, name: v.retainPrefix ? current.name : v.prefix+current.name}));
    }

    _.set(this._evtcache, [id, name], handlers);
    return handlers;
  }

  // TODO
  checkCycles() {
    return this;
  }
}

module.exports = Network;
