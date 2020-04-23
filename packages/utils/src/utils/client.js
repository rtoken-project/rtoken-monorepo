import { ApolloClient } from 'apollo-client';
import { InMemoryCache } from 'apollo-cache-inmemory';
import { HttpLink } from 'apollo-link-http';
import fetch from 'cross-fetch';

// rDAI mainnet subgraph
const DEFAULT_SUBGRAPH_URL =
  'https://api.thegraph.com/subgraphs/name/pi0neerpat/mcd-rdai';

export const getClient = ({ uri = DEFAULT_SUBGRAPH_URL, debug } = {}) => {
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
