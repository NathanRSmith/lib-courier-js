'use strict';

const _ = require('lodash');
const uuid = require('uuid/v4');

class Network {
  constructor(opts={}) {
    this.id = opts.id || uuid();
    this.couriers = {};
    this.connections = [];
  }
  toJSON() {
    return {
      id: this.id,
      couriers: _.invokeMap(this.couriers, 'toJSON'),
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

  // TODO: optimizable via caching per node
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

  // TODO: optimizable via caching per node
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
      if(!current.down) _.each(this.findReferrers(current.id), v => q.push({id: v.from, name: v.retainPrefix ? current.name : v.prefix+current.name}));
    }

    // throw new Error(`No handler registered for event "${name}"`);
    return handlers;
  }

  // TODO
  checkCycles() {
    return this;
  }
}

module.exports = Network;
