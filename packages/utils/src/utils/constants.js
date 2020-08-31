import erc20 from "../abis/ERC20.json";
import rtoken from "../abis/RToken.json";
import ias from "../abis/IAllocationStrategy.json";

const DEFAULT_NETWORK = "homestead";

const SUBGRAPH_URLS = {
  homestead: "https://api.thegraph.com/subgraphs/name/rtoken-project/rdai",
  kovan: "https://api.thegraph.com/subgraphs/name/rtoken-project/rdai-kovan",
  local: "http://localhost:8000/subgraphs/name/rtoken-test",
};

const CONTRACTS = {
  dai: {
    abi: erc20,
    kovan: "0x4F96Fe3b7A6Cf9725f59d353F723c1bDb64CA6Aa",
    homestead: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
    local: "0xe41fc2bf7F540Cc9e83c728FAfB5Aef26c7881db",
  },
  rdai: {
    abi: rtoken,
    kovan: "0x462303f77a3f17Dbd95eb7bab412FE4937F9B9CB",
    homestead: "0x261b45D85cCFeAbb11F022eBa346ee8D1cd488c0",
    local: "0x625aD1AA6469568ded0cd0254793Efd0e5C0394F",
  },
  ias: {
    abi: ias,
    kovan: "0x2F3633118bc278d22Af58474c0a047dFC85aB31D",
    homestead: "0xbb16307aaed1e070b3c4465d4fda5e518bdc2433",
    local: "0x25eedC456AE0744FF6D04CeCf8423D9c9200cd24",
  },
};

export { DEFAULT_NETWORK, SUBGRAPH_URLS, CONTRACTS };
