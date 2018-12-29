var _ = require('lodash');

class Data {
  constructor(data) {
    this._data = data || {};
  }
  get(path) {
    if(_.isArray(path)) return _.map(path, this.get.bind(this));
    return _.get(this._data, path);
  }
  has(path) {
    // if array, test if any do NOT exist, then return inverse
    if(_.isArray(path)) return !_.some(path, v => !this.has(v));
    return !_.isUndefined(this.get(path));
  }
  reset() {
    this._data = {};
    return this;
  }
  set(path, value) {
    if(_.isPlainObject(path)) _.merge(this._data, path);
    else if(_.isUndefined(value)) _.set(this._data, path, undefined);
    else _.set(this._data, path, value);
    return this;
  }
  keys() {
    return _.keys(this._data);
  }
  toJSON() {
    return _.cloneDeep(this._data);
  }
}
module.exports = Data;
