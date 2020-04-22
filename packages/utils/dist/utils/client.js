(function (global, factory) {
  if (typeof define === "function" && define.amd) {
    define(['module', 'cross-fetch', 'apollo-client', 'apollo-cache-inmemory', 'apollo-link-http'], factory);
  } else if (typeof exports !== "undefined") {
    factory(module, require('cross-fetch'), require('apollo-client'), require('apollo-cache-inmemory'), require('apollo-link-http'));
  } else {
    var mod = {
      exports: {}
    };
    factory(mod, global.crossFetch, global.apolloClient, global.apolloCacheInmemory, global.apolloLinkHttp);
    global.client = mod.exports;
  }
})(this, function (module, fetch) {
  'use strict';

  const { ApolloClient };
  const { InMemoryCache };
  const { HttpLink };


  // rDAI mainnet subgraph
  const DEFAULT_SUBGRAPH_URL = 'https://api.thegraph.com/subgraphs/name/pi0neerpat/mcd-rdai';

  const getClient = ({ uri = DEFAULT_SUBGRAPH_URL, debug } = {}) => {
    const cache = new InMemoryCache();
    const link = new HttpLink({
      uri,
      fetch
    });

    return new ApolloClient({
      link,
      cache,
      onError: e => {
        debug && console.log(e);
      },
      defaultOptions: {
        query: {
          fetchPolicy: 'network-only'
        }
      }
    });
  };
  module.exports = getClient;
});