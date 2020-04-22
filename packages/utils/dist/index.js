(function (global, factory) {
  if (typeof define === "function" && define.amd) {
    define(['module', './main', './utils/client'], factory);
  } else if (typeof exports !== "undefined") {
    factory(module, require('./main'), require('./utils/client'));
  } else {
    var mod = {
      exports: {}
    };
    factory(mod, global.main, global.client);
    global.index = mod.exports;
  }
})(this, function (module, RTokenUtils, getClient) {
  'use strict';

  module.exports = { RTokenUtils, getClient };
});