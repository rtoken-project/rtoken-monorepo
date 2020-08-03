import { Contract } from "@ethersproject/contracts";
import { InfuraProvider, JsonRpcProvider } from "@ethersproject/providers";
import RToken from "@rtoken/contracts/build/contracts/RToken";

const RTOKEN_ADDRESS = "0x625aD1AA6469568ded0cd0254793Efd0e5C0394F";

export const getWeb3Provider = () => {
  if (process.env.LOCAL) {
    return new JsonRpcProvider("0.0.0.0:8545", "homestead");
  }
  return new InfuraProvider("homestead", process.env.INFURA_KEY);
};

export const getRTokenContract = async () => {
  const contract = new Contract(RTOKEN_ADDRESS, RToken.abi, getWeb3Provider());
  return contract;
};
