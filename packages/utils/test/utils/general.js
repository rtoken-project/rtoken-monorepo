import { InfuraProvider, JsonRpcProvider } from "@ethersproject/providers";
import RTokenUtils, { getClient } from "../../src";

export const getWeb3Provider = () => {
  if (process.env.LOCAL) return new JsonRpcProvider("http://localhost:8545");
  return new InfuraProvider("homestead", process.env.INFURA_KEY);
};

export const getRutils = () => {
  const apolloInstance = getClient({
    uri: process.env.SUBGRAPH_URL,
    debug: false,
  });

  return new RTokenUtils(apolloInstance, getWeb3Provider(), {
    debug: true,
    network: process.env.LOCAL ? "local" : "homestead",
  });
};
