const { ApolloClient } = require('apollo-client');
const { InMemoryCache } = require('apollo-cache-inmemory');
const { HttpLink } = require('apollo-link-http');
const fetch = require('cross-fetch');

// rDAI mainnet subgraph
const DEFAULT_SUBGRAPH_URL =
  'https://api.thegraph.com/subgraphs/name/pi0neerpat/mcd-rdai';

const getClient = ({ uri = DEFAULT_SUBGRAPH_URL, debug } = {}) => {
  const cache = new InMemoryCache();
  const link = new HttpLink({
    uri,
    fetch,
  });

  return new ApolloClient({
    link,
    cache,
    onError: (e) => {
      debug && console.log(e);
    },
    defaultOptions: {
      query: {
        fetchPolicy: 'network-only',
      },
    },
  });
};
module.exports = getClient;
