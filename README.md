# Lib-Courier-JS

```
docker build -t lib-courier-js .
docker run --rm -it -v `pwd`:/opt/pkg -v /opt/pkg/node_modules lib-courier-js bash
```

## Namespaces

Create a namespace to isolate a set of names from the scheme of the overall system. Within the namespace handlers can be known by a shorter name and the system can prefix those names with the namespace name as desired. This way the components do not need to know of the organization of the overall system, just their own world.

### `#registerNamespace(prefix[, courier[, override=false]]) -> Courier`

Creates or registers a courier with a given prefix. Any requests made to the target courier will be delegated to the registered courier if not otherwise explicitly registered.

### `#findNamespace(name) -> Namespace`

Finds the namespace for a name if one exists.


## Request-Reply

The request-reply pattern is common in server programming. For a given name, a handler can be registered to handle requests to that name. Handlers will be given the request data and context. Requesters must provide a context and arguments which will be given to the handler if one exists.

### `#reply(name, handler[, override=false])`

Registers a handler for the given name. The handler should have the signature `handler(context, data[, cb]) -> Promise`. It should either receive a callback function or a promise. The callback signature is `cb(err, result)`. If no callback arg is accepted it should return a Promise that either rejects with an error or fulfills with a single result object.

If the handler arity is 3, it will automatically be promisified for internal use, meaning that callers need not necessarily use the cb style. If the arity is 2, it will automatically be wrapped so the handler can either return/throw synchronously or as a promise.

```
// Sync
courier.reply('reverse', (ctx, data) => {
  return data.split('').reverse().join('');
});

// Async
courier.reply('reverse', (ctx, data) => {
  return Promise.resolve(data.split('').reverse().join(''));
});

// Callback
courier.reply('reverse', (ctx, data, cb) => {
  cb(null, data.split('').reverse().join(''));
});
```

### `#request(context, name, data[, cb]) -> Promise`

Makes a request to the given name with the given context and data. Optionally supports a callback. If the callback is omitted returns a promise. Throws an error if the name is not registered.

```
// Promise
courier.request({}, 'reverse', 'hi there')
  .then(rep => assert.equal(rep, 'ereht ih'));

// Callback
courier.request({}, 'reverse', 'hi there', (err, rep) => {
  assert(!err);
  assert.equal(rep, 'ereht ih');
});
```


## Context

The Context object is a container for information related to a request/event such as id, logger, ttl, etc. One can be created via `courier.createContext`, but typically will be derived from some parent context via `context.child`. It also contains a `data` property which is a generic kvp container for arbitrary data.

### `Context(logger[, id[, expiration[, data]]]) -> Context`

#### TODO

### `#child([padding=0]) -> Context`

Creates a child context with the expiration reduced by the given padding. The child's is derived from the parent by adding `{{parentid}}.{{childIdx}}` where `idx` is the current count of created children.

### `#isExpired() -> Boolean`

Returns whether the expiration date has been reached.
