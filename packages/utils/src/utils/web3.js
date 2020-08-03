import { Contract } from "@ethersproject/contracts";
import CONTRACTS from "./contracts";

const getContract = async (name, network, provider) => {
  const contract = new Contract(
    CONTRACTS[name][network],
    CONTRACTS[name].abi,
    provider
  );
  return contract;
};

export { getContract };
