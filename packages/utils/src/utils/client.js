const { ApolloClient } = require('apollo-client');
const { InMemoryCache } = require('apollo-cache-inmemory');
const { HttpLink } = require('apollo-link-http');

const getClient = ({ uri, debug } = {}) => {
  const cache = new InMemoryCache();
  const link = new HttpLink({
    uri,
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
