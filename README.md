# rToken Monorepo

[![lerna](https://img.shields.io/badge/maintained%20with-lerna-cc00ff.svg)](https://lerna.js.org/)

## Our Wares:

These packages are included in this monorepo:

| Package                                                      | Description                                                           | Type                        | Packages used     |
| ------------------------------------------------------------ | --------------------------------------------------------------------- | --------------------------- | ----------------- |
| :scroll: @rtoken/contracts ([link](./packages/contracts))    | Performs all web3 function                                            | Truffle project / JS module | none              |
| :hammer_and_wrench: @rtoken/utils ([link](./packages/utils)) | Utility library for using the rToken contracts                        | JS module                   | @rtoken/contracts |
| :satellite: @rtoken/api ([link](./packages/api))             | Code for the API deployed at [api.rdai.money](https://api.rdai.money) | Express.js server           | @rtoken/utils     |

## Looking for something else?

Example dapps and more can be found in our other repos:

| Package                                                                                                   | Description                                                                            | Type               | Packages used                     |
| --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------ | --------------------------------- |
| :money_with_wings: Official dapp ([link](https://github.com/rtoken-project/rdai-app))                     | Code for the dapp deployed at [app.rdai.money](https://app.rdai.money)                 | Vue App            | @rtoken/contracts                 |
| :crown: Example dapp - High Priests ([link](https://github.com/rtoken-project/example-dapp-high-priests)) | Code for the dapp deployed at [highpriests.rdai.money](https://highpriests.rdai.money) | React App (Gatsby) | @rtoken/api, @rtoken/utils        |
| :telescope::stars: rToken Explorer ([link](https://github.com/rtoken-project/rtoken-explorer))            | Code for the explorer deployed at [explorer.rdai.money](https://explorer.rdai.money)   | React App          | rDAI Subgraph (see @rtoken/utils) |
