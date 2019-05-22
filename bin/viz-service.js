'use strict';

const _ = require('lodash');
const fs = require('fs');
const Promise = require('bluebird');

const yargs = require('yargs')
  .usage('Generate a GraphViz dotfile from service info visualizing service modules & network')
  .group(['f', 's'], 'Inputs (one of):')
  .option('f', {alias: 'file', description: 'Service JSON file', type: 'string'})
  .option('s', {alias: 'stdin', description: 'Service JSON stdin', type: 'boolean'})
  .help('help')
  .alias('h', 'help');
const argv = yargs.argv;
if(!argv.file && !argv.stdin) return yargs.showHelp();


function getData() {
  if(argv.file) return JSON.parse(fs.readFileSync(argv.file));

  // otherwise stdin
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.on('data', (chunk) => {
      data += chunk;
    });
    process.stdin.on('end', () => {
      try { resolve(JSON.parse(data)); }
      catch(err) { reject(err); }
    });
    process.stdin.on('error', reject);
  });
}

function generateDot(data) {
  let lookup = {};
  let str = 'digraph g {\n\n';

  // nodes
  str += _.chain(data.couriers)
    .each(v => {
      v.name = v.name || 'root';
      lookup[v.id] = v.name;
    })
    .map(v => `  node_${_.snakeCase(v.id)} [label="${v.name}"]`)
    .join('\n')
    .value();

  // modules
  if(data.modules) {
    str += '\n\n';
    str += _.chain(data.modules)
      .map(v => `  mod_${_.snakeCase(v.group.concat(v.id).join('__'))} [label="${v.id}" shape=box]`)
      .join('\n')
      .value();
  }

  str += '\n\n';

  // edges
  str += _.chain(data.connections)
    .map(v => `  node_${_.snakeCase(v.from)} -> node_${_.snakeCase(v.to)} [label="${v.prefix}${v.retainPrefix ? '*' : ''}"]`)
    .join('\n')
    .value();

  if(data.modules) {
    str += '\n\n';
    str += _.chain(data.modules)
      .map(v => `  mod_${_.snakeCase(v.group.concat(v.id).join('__'))} -> node_${_.snakeCase(v.courier)} [arrowhead=none]`)
      .join('\n')
      .value();
  }

  str += '\n\n}';

  return str;
}


Promise.try(getData)
  .then(generateDot)
  .then(console.log);
