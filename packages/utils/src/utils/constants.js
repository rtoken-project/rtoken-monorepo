const DEFAULT_NETWORK = "homestead";

const SUBGRAPH_URLS = {
  homestead: "https://api.thegraph.com/subgraphs/name/rtoken-project/rdai",
  kovan: "https://api.thegraph.com/subgraphs/name/rtoken-project/rdai-kovan",
  local: "http://localhost:8000/subgraphs/name/rtoken-test",
};

export { DEFAULT_NETWORK, SUBGRAPH_URLS };
