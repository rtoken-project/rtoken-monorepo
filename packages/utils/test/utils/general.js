import { JsonRpcProvider } from "@ethersproject/providers";
import RTokenUtils, { getClient } from "../../src";

export const getWeb3Provider = () => {
  return new JsonRpcProvider("http://localhost:8545");
};

export const getRutils = () => {
  return new RTokenUtils(
    getClient({
      network: "local",
      debug: true,
    }),
    getWeb3Provider(),
    {
      network: "local",
      debug: true,
    }
  );
};
