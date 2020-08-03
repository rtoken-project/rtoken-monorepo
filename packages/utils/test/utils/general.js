import RTokenUtils, { getClient } from "../../src";

import { getWeb3Provider } from "./web3";

export const getRutils = () => {
  const web3Provider = getWeb3Provider();

  const apolloInstance = getClient({
    uri: process.env.SUBGRAPH_URL,
    debug: false,
  });

  const options = { debug: true, network: "local" };
  return new RTokenUtils(apolloInstance, web3Provider, options);
};
