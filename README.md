# rToken Monorepo

[![lerna](https://img.shields.io/badge/maintained%20with-lerna-cc00ff.svg)](https://lerna.js.org/)

## Our Wares:

| Package                           | Description                                       | Type                | Packages used     |
| --------------------------------- | ------------------------------------------------- | ------------------- | ----------------- |
| :scroll: @rtoken/contracts        | Magic sauce                                       | Truffle / JS module | none              |
| :hammer_and_wrench: @rtoken/utils | Utility library                                   | JS module           | @rtoken/contracts |
| :satellite: @rtoken/api           | Open API [api.rdai.money](https://api.rdai.money) | Express.js server   | @rtoken/utils     |

## Looking for something else?

Example dapps and more can be found in our other repos:

| Package                                                                                                   | Description                                                                            | Type               | Packages used                     |
| --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------ | --------------------------------- |
| :money_with_wings: Official dapp ([link](https://github.com/rtoken-project/rdai-app))                     | Code for the dapp deployed at [app.rdai.money](https://app.rdai.money)                 | Vue App            | @rtoken/contracts                 |
| :crown: Example dapp - High Priests ([link](https://github.com/rtoken-project/example-dapp-high-priests)) | Code for the dapp deployed at [highpriests.rdai.money](https://highpriests.rdai.money) | React App (Gatsby) | @rtoken/api, @rtoken/utils        |
| :telescope::stars: rToken Explorer ([link](https://github.com/rtoken-project/rtoken-explorer))            | Code for the explorer deployed at [explorer.rdai.money](https://explorer.rdai.money)   | React App          | rDAI Subgraph (see @rtoken/utils) |
