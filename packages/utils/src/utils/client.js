import { ApolloClient } from "apollo-client";
import { InMemoryCache } from "apollo-cache-inmemory";
import { HttpLink } from "apollo-link-http";
import fetch from "cross-fetch";

import { SUBGRAPH_URLS } from "./constants";

export const getClient = ({
  url = SUBGRAPH_URLS.homestead,
  network,
  debug,
} = {}) => {
  let subgraphURL = url;
  if (network) subgraphURL = SUBGRAPH_URLS[network];
  const cache = new InMemoryCache();
  const link = new HttpLink({
    uri: subgraphURL,
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
        fetchPolicy: "network-only",
      },
    },
  });
};
