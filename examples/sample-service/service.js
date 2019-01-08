'use strict';

const Service = require('../../lib/service');

const logger = {
  fatal: console.error,
  error: console.error,
  warn: console.error,
  info: console.log,
  debug: console.log,
  trace: console.log,
  child: () => logger
};

const CONFIG = {
  name: 'sample app',
  modules: {
    http: {
      module: 'http-server-module',
      config: {
        port: 8000,
        routes: [
          {method: 'GET', route: '/ping', request: 'controller:ping'},
          {method: 'GET', route: '/time', request: 'controller:time'},
          {method: 'POST', route: '/sum', request: 'controller:sum'}
        ]
      }
    },
    controller: {
      module: 'controller-module',
      namespace: 'controller:'
    }
  }
}

function main() {
  const service = new Service();

  process.on('SIGINT', () => service.terminate().then(() => process.exit()).catch(err => process.exit(1)));
  process.on('uncaughtException', () => service.terminate().then(() => process.exit()).catch(err => process.exit(1)));

  return service.initialize({
    config: CONFIG,
    logger,
    loadableModules: {
      'http-server-module': require('./http-server-module'),
      'controller-module': require('./controller-module')
    }
  })
  .catch(err => {
    if(err.stack) logger.fatal(err.stack);
    else logger.fatal(err);
    process.exit(1);
  });

}
main();
