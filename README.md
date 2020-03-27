# rToken Monorepo

[![lerna](https://img.shields.io/badge/maintained%20with-lerna-cc00ff.svg)](https://lerna.js.org/)

| Package                                                                   | Description                                                                            | Type               | Local dependencies                         |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------ | ------------------------------------------ |
| :scroll: @rtoken/contracts ([link](./packages/contracts))                 | Performs all web3 function                                                             | Truffle project    | none                                       |
| :hammer_and_wrench: @rtoken/utils ([link](./packages/utils))              | Utility library for reading/writing from the contract                                  | Javascript module  | @rtoken/contracts                          |
| :satellite: @rtoken/api ([link](./packages/api))                          | Code for the API deployed at [api.rdai.money](https://api.rdai.money)                  | Express.js server  | @rtoken/utils (formerly @rtoken/analytics) |
| :money_with_wings: (Official dapp) rdai-app ([link](./packages/rdai-app)) | Code for the dapp deployed at [app.rdai.money](https://app.rdai.money)                 | Vue App            | @rtoken/contracts                          |
| :crown: (Example dapp) High Priests ([link](./packages/high-priests))     | Code for the dapp deployed at [highpriests.rdai.money](https://highpriests.rdai.money) | React App (Gatsby) | @rtoken/api, @rtoken/utils                 |
| :telescope::stars: rToken Explorer ([link](./packages/explorer))          | Code for the explorer deployed at [explorer.rdai.money](https://explorer.rdai.money)   | React App          | rDAI Subgraph (see @rtoken/utils)          |
