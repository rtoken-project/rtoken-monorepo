import { Contract } from "@ethersproject/contracts";
import { CONTRACTS } from "./constants";

const getContract = async (name, network, provider) => {
  return new Contract(CONTRACTS[name][network], CONTRACTS[name].abi, provider);
};

export { getContract };
