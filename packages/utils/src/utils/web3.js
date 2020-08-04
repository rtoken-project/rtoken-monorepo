import { Contract } from "@ethersproject/contracts";

import erc20 from "@rtoken/contracts/build/contracts/ERC20.json";
import rDAI from "@rtoken/contracts/build/contracts/rDAI.json";
import ias from "@rtoken/contracts/build/contracts/IAllocationStrategy.json";

const CONTRACTS = {
  dai: {
    abi: erc20.abi,
    kovan: "0x4F96Fe3b7A6Cf9725f59d353F723c1bDb64CA6Aa",
    homestead: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
    local: "0xe41fc2bf7F540Cc9e83c728FAfB5Aef26c7881db",
  },
  rdai: {
    abi: rDAI.abi,
    kovan: "0x462303f77a3f17Dbd95eb7bab412FE4937F9B9CB",
    homestead: "0x261b45D85cCFeAbb11F022eBa346ee8D1cd488c0",
    local: "0x625aD1AA6469568ded0cd0254793Efd0e5C0394F",
  },
  ias: {
    abi: ias.abi,
    kovan: "",
    homestead: "",
    local: "0x25eedC456AE0744FF6D04CeCf8423D9c9200cd24",
  },
};

const getContract = async (name, network, provider) => {
  return new Contract(CONTRACTS[name][network], CONTRACTS[name].abi, provider);
};

export { getContract };
