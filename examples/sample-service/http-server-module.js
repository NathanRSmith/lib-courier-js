'use strict';

const _ = require('lodash');
const http = require('http');
const URL = require('url').URL;
const qs = require('querystring');
const uuid = require('uuid/v4');

class HttpServer {
  constructor(config, courier, service) {
    this.config = config;
    this.courier = courier;
    this.service = service;
  }
  initialize() {
    this.server = http.createServer((req, rep) => {
      const req_id = uuid();
      const logger = this.service.logger.child({req_id});
      const url = new URL(req.url, 'http://example.org/');
      logger.debug(`${req.method} ${req.url}`);
      rep.setHeader('Content-Type', 'application/json');

      const route = _.find(this.config.routes, {method: req.method, route: url.pathname});
      if(route) {

        // NOTE: very naive. Do better loading/parsing
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
          try {
            const data = extractData(req, url, body.length ? JSON.parse(body) : undefined);
            this.courier.request(
                this.courier.createContext(logger, req_id),
                route.request,
                data
              )
              .then(res => {
                rep.statusCode = 200;
                if(res) rep.end(JSON.stringify(res));
                else rep.end();
              })
              .catch(err => sendErr(rep, err));
          }
          catch(err) { sendErr(rep, err); }
        });
        req.on('error', err => sendErr(rep, err));

      }
      else {
        rep.statusCode = 404;
        rep.end();
      }
    });
  }
  terminate() { this.server.close(); }
  registerSources() {
    this.service.logger.info(`Listening on port ${this.config.port}`);
    this.server.listen(this.config.port);
  }
}

module.exports = function(config, courier, service) {
  return new HttpServer(config, courier, service);
}

function extractData(req, url, body) {
  let data = {};
  // TODO: path vars
  data = _.extend(data, qs.parse(url.query), body);
  return data;
}

function sendErr(rep, err) {
  rep.statusCode = err.statusCode || 500;
  rep.end(JSON.stringify(_.pick(err, ['name', 'message'])));
}
