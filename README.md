# Lib-Courier-JS

This library can be used to create an event bus or communication mediator to help maintain loose coupling between application components. It is inspired by [backbone.radio](https://github.com/marionettejs/backbone.radio) but adds some additional patterns as well as adhering to the Node.js eventemitter conventions. It can be used for purely intra-service component communication as well as to wrap inter-service interfaces as desired. The main goal is to remove direct calls between components so developers can focus on their APIs rather than where they are organized.

Three messaging patterns are provided:

* **Request/Reply**: Named requests are delivered to the registered replier from which the result is delivered back to the requester
* **Pub/Sub**: Named events are delivered to registered subscribers
* **Push/Pull**: (Not yet implemented) Named events are delivered to a registered puller

Additionally, a barebones framework is provided to organize handlers into "modules" which can be composed into a single running service instance.

NPM: https://www.npmjs.com/package/lib-courier-js

#### Contents

* [Couriers, Networks & Namespaces](#couriers-networks--namespaces)
* [Patterns](#patterns)
    * [Request/Reply](#requestreply)
    * [Pub/Sub](#pubsub)
    * [Push/Pull](#pushpull)
* [Services, Modules & Composition](#services-modules--composition)
* [API](#api)
    * [Courier](#courier)
    * [Context](#context)
    * [DataManager](#datamanager)
    * [Service](#service)
    * [Network](#network)
* [Development](#development)


## Couriers, Networks & Namespaces

While a single courier can be used to mediate messages in patterns, they are even more powerful when organized into a network. Unless explicitly specified otherwise, couriers are placed into a global, default [network](#Network). Couriers can be linked together via a namespace prefix to allow messages to propagate depending on the pattern being used. A courier can be namespaced multiple times by multiple nodes.

## Patterns

### Request/Reply

In the request/reply pattern, requests are made to a specific name and are delivered to the first discovered replier. In a single courier, only one replier can be registered to a name at a time. The search for a replier spreads from the requester's courier in the following manner:

* Local name replier
* Local pattern replier
* List all linked namespaces whose prefix matches the request name, slice off the prefix (unless `retainPrefix` is enabled), add to the search queue
* List all linking couriers, add to the search queue
* Get next item from the queue, repeat until handler is found or queue is empty

With each iteration, the search casts a wider net until a replier is found or produces an error. Since it looks at the requester's courier first, names in the local vicinity can use their local name, while inter-courier requests must be prefixed with the desired namespace relative. To avoid cycles, node are only visited once per name per search. Search results are cached until the network changes.

Repliers can be registered for a name or a pattern:

```
courier.reply('test-1', (ctx, data) => ...);
courier.replyPattern('^test.*', (ctx, name, data) => ...);
```

Repliers can use promises or callbacks and all are automatically promisified using [bluebird](https://github.com/petkaantonov/bluebird/). See the [API docs](#Courier) below or the tests for details.

### Pub/Sub

In the pub/sub patter, events are emitted with a specific name and are delivered to all registered listeners. The search for listeners spreads from the emitter's courier in the following manner:

* Local name listeners
* Local pattern listeners
* List all linked namespaces, add to the search queue
* List all linking couriers, prepend the current node's prefix (unless `retainPrefix` is enabled), add to the search queue
* Get next item from the queue, repeat until the queue is empty

Local listeners can use the event's local name while linked couriers must prepend the expected emitter's namespace. To avoid discovering a subscriber multiple times, once the search traverses into a linked namespace it will not propagate back to the linker. Search results are cached until the network changes.

Listeners can be registered for a name or a pattern:

```
courier.on('test-1', (ctx, data) => ...);
courier.once('test-1', (ctx, data) => ...); // only called once
courier.onPattern('^test.*', (ctx, name, data) => ...);
```

Return values are ignored, but errors are not swallowed (may be an option in the future).

### Push/Pull

Not yet implemented


## Services, Modules & Composition

One of the goals in creating this project was to encapsulate namespace functionality into modules/groups and be able to declaratively compose them into a service. Further, it was desired to be able to have different configurations depending on when and where the modules were being run.

For instance, when running locally during development it is much easier to manage a few composed instances vs dozens of instances split solely on functionality. But in testing or production, an entirely different arrangement might be appropriate. Some groups that pose no current performance limitations could be combined while others that require dedicated instances or need to be horizontally scaled could be run separately with no module changes required.

In an attempt to accomplish this goal, `lib-courier-js` provides a minimal framework for composing "modules" and managing their lifecycle. This framework accepts a root courier instance and a configuration of where to find modules, what namespaces to put them in and what configuration to provide to them. When combined with a configuration management solution like [node-config](https://github.com/lorenwest/node-config), it enables a nice balance of development and operational flexibility.

A very basic service example can be found at `/examples/sample-service` and a few reusable modules are located in `/lib/service/modules`. More examples will be provided in the future, but it has been used privately to compose dozens of interdependent micro-services consisting of multiple modules each. They communicate directly via courier when running in the same instance, or via networked messaging modules when run separately, all with no changes to the modules themselves.

### Provided Modules

#### CannedReplier

`lib-courier-js/lib/service/modules/canned-replier`

#### DirectoryLoader

`lib-courier-js/lib/service/modules/directory-loader`

#### EventLogger

`lib-courier-js/lib/service/modules/event-logger`

#### ServiceInfo

`lib-courier-js/lib/service/modules/service-info`



## API
### Courier

#### `new Courier([options])`

Options:

* `id`: Courier id or uuid if omitted
* `name`: Courier name
* `network`: [Network](#Network) instance or global if omitted

#### `#registerNamespace(prefix[, courier[, opts]]) -> Courier`

Links two couriers on the network with the given prefix. Automatically creates a courier if omitted. Returns the linked courier.

Options:

* `override`: Whether to allow overriding a previously registered prefix
* `courierOpts`: Options to pass to the auto-created courier if `courier` is not provided
* `retainPrefix`: Whether to retain the prefix when searching for handlers

#### `#request(ctx, name, data[, cb]) -> Promise`

Alias: `req`

Searches the network for a replier. If `cb` is provided, the signature is `cb(err, result)`. Invokes the handler with the provided context and data. If the handlers is a pattern replier, request name is also provided.

#### `#reply(name, handler[, opts]) -> this`

Registers a replier for a request name. Handler signature is `handler(ctx, data[, cb])`. If handler has a `cb` arg (arity is 3), it will expect to be called as `cb(err, result)`. Handlers are automatically promisified and can either return a promise or return/throw synchronously.

Options:

* `override`: Whether to allow overriding a previously registered name. Default `false`.

#### `#replyPattern(pattern, handler[, opts]) -> this`

Registers a replier for a request pattern. Handler signature is `handler(ctx, name, data[, cb])`. If handler has a `cb` arg (arity is 4), it will expect to be called as `cb(err, result)`. Handlers are automatically promisified and can either return a promise or return/throw synchronously.

Options:

* `override`: Whether to allow overriding a previously registered pattern. Default `false`.

#### `#emit(ctx, name, data) -> this`

Searches the network for listeners. Invokes each listener with the provided context and data. If the handler is a pattern listener, event name is also provided.

#### `#on(name, handler[, opts]) -> this`

Registers a listener for the event name. Handler signature is `handler(ctx, data)`.

Options:

* `once`: Whether to only invoke the handler once

#### `#once(name, hander[, opts]) -> this`

Shortcut for `context.on(name, handler, {once: true})`.

#### `#onPattern(pattern, handler) -> this`

Registers a listener for the event pattern. Handler signature is `handler(ctx, name, data)`.

#### `#createContext(...args) -> Context`

Shortcut for creating a new [Context](#Context).

#### `#toJSON() -> Object`

Returns a simplified version of the courier containing:

* `id`
* `name`
* `namespaces`: Map of prefix to courier id
* `reply`: Map of request names to repliers
    * `calls`: Number of invocations
    * `lastCalled`: Timestamp of last invocation
* `replyPattern`: Map of request patterns to repliers
    * `calls`: Number of invocations
    * `lastCalled`: Timestamp of last invocation
* `event`: Map of event names to listeners
    * `calls`: Number of invocations
    * `lastCalled`: Timestamp of last invocation
    * `once`: Whether it was registered as a `once` listener
* `eventPattern`: Map of event patterns to listeners
    * `calls`: Number of invocations
    * `lastCalled`: Timestamp of last invocation
* `requests`: Map of requested names to stats
    * `calls`: Number of invocations
    * `lastCalled`: Timestamp of last invocation
* `events`: Map of emitted names to stats
    * `calls`: Number of emissions
    * `lastCalled`: Timestamp of last emissions


### Context

Sending messages via courier requires a context be provided. This intended to be the "context" for the request/event/message and while the courier and network have no opinions about its structure, it is typically a place to keep some metadata, logger & expiry. The `Context` class in lib-courier is likely sufficient for most purposes, but ultimately it is up the event source to provide a context.

#### `new Context([data[, opts]])`

The `data` argument is used to populate the `data` property as a `DataManager`.

Options:

* `id`: Context id or uuid if omitted
* `logger`: Logger object
* `scope_logger`: Whether to automatically scope the logger on instantiation via `#scopeLogger`
* `logger_id_field`: Field name to put `id` if `scope_logger: true`. Default `ctx_id`.
* `exp`: Expiry timestamp
* `ttl`: Duration (ms) until expiry. Used to set `exp` as `now + ttl`.

#### `#child(padding=0) -> Context`

Creates a new context with the same data & opts as the parent. If `padding` is provided, subtracts from the `exp` date. Child's `id` is automatically scoped as `{{parent.id}}.{{child_idx}}`.

#### `#scopeLogger() -> this`

Used internally if `scope_logger` is `true`. Default implementation assumes the `logger` has a `child` method that accepts a kvp argument to which it provided the context id as the `logger_id_field` key.

#### `#isExpired() -> Boolean`

If `exp` is set, returns whether it has been reached.

#### `#get(...) -> Object`

Shortcut for `ctx.data.get(...)`.

#### `#set(...) -> this`

Shortcut for `ctx.data.set(...)`;

#### `#unset(...) -> this`

Shortcut for `ctx.data.unset(...)`;


### DataManager

A helper class wrapping a simple kvp datastore. Core functionality uses [lodash](https://lodash.com/) `get`, `set`, `has`, `unset`, `keys` utilities.

#### `new DataManager([data])`
#### `#get(path) -> Object`
#### `#has(path) -> Boolean`
#### `#reset() -> this`
#### `#set(path, value) -> this`
#### `#unset(path) -> this`
#### `#inc(path[, n=1]) -> this`
#### `#dec(path[, n=1]) -> this`
#### `#keys() -> [string]`
#### `#toJSON() -> Object`


### Service

Located in `/lib/service/index.js`.

#### `initialize(opts) -> Promise(this)`

Initializes the service by calling its own methods in the following order.

* `validateConfig`: Validates the provided configuration against the schema
* `preInstantiation`: Hook
* `instantiateModules`: Loads & instantiates modules
* `postInstantiation`: Hook
* `preInitialization`: Hook
* `initializeModules`: Calls optional `initialize` method on all modules
* `postInitialization`: Hook
* `preRegistration`: Hook
* `registerHandlers`: Calls optional `registerHandlers` method on all modules
* `registerSources`: Calls optional `registerSources` method on all modules
* `postRegistration`: Hook

Options:

* `config`: Service configuration. See `/lib/service/schema.json` for the JSON schema.
* `logger`: Logger object. Will be provided to modules on instantiation. Is minimally expected to have `debug` & `info` methods.`
* `courier`: Root courier, created if omitted
* `require`: Require function to use when loading modules
* `loadableModules`: Map of preloaded module factories. Looks here first if provided before attempting to load.

#### `terminate() -> Promise(this)`

Calls optional `terminate` method on all modules.



### Network

#### `new Network([opts])`

Options:

* `id`: Network id or uuid if omitted

#### `#registerCourier(courier) -> this`

Registers a if it has not already been registered.

#### `#registerNamespace(prefix, target, source[, opts]) -> this`

Registers a connection between the source and target couriers.

Options:

* `override`
* `retainPrefix`

#### `#findRequestHandler(name, id) -> handler`

Searches the network for a handler for the given name starting at the courier `id`. Returns an object containing:

* `courier`: Courier to which the handler is registered
* `handler`: Handler object
* `name`: Resolved request name when handler was found

#### `#findEventHandlers() -> handlers`

Searches the network for handlers for the given name starting at the courier `id`. Returns an list of objects containing:

* `courier`: Courier to which the handler is registered
* `handler`: Handler object
* `name`: Resolved event name when handler was found

#### `#toJSON() -> Object`

Returns a simplified version of the network containing:

* `id`
* `couriers`: Map of id to `courier.toJSON()`
* `connections`: List of links (namespaces) between couriers on the network
    * `from`: Courier id
    * `to`: Courier id
    * `prefix`: Namespace prefix
    * `retainPrefix`


## Development

```
docker build -t lib-courier-js .
docker run --rm -it -v `pwd`:/opt/pkg -v /opt/pkg/node_modules lib-courier-js bash
BLUEBIRD_DEBUG=1 yarn -- run test
```
