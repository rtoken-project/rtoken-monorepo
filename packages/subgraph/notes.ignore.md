old commands

```js
"setup_subgraph_local": "cd subgraph && yarn && yarn codegen && yarn create-local && yarn deploy-local",
"start_ganache": "ganache-cli -h 0.0.0.0 -m sweet",
"deploy_contracts": "truffle test --network subgraphDev test/deployContracts.js",
"deploy_subgraph": "cd subgraph && yarn create-local && yarn deploy-local --watch",
"start_subgraph": "yarn deploy_contracts && yarn deploy_subgraph",
"test_local": "LOCAL=true SUBGRAPH_URL=$npm_package_subgraph_local_url mocha --timeout 7000 test/RTokenAnalytics.test.js",
"test": "SUBGRAPH_ID=$npm_package_subgraph_mainnet_id SUBGRAPH_URL=\$npm_package_subgraph_mainnet_url mocha --timeout 7000 test/RTokenAnalytics.test.js",
```

Todo:

1. Remove contracts, compound, truffle commands, truffle.js, /abis/CompoundAllocationStrategy
2. add gitignore for /build and /generated
