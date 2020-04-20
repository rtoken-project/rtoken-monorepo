# @rtoken/utils

> NOTE: This package was formerly named "rtoken-analytics". There is A LOT going on in this one package, so we may break this apart into smaller individual pieces for each.

This library provides tools for getting rDAI and rToken data into your dapp.

| Feature                      | Status             | Notes                                                                           |
| ---------------------------- | ------------------ | ------------------------------------------------------------------------------- |
| Get rDAI data in your dapp   | :white_check_mark: | Currently in Beta                                                               |
| Subgraph for rDAI on mainnet | :white_check_mark: | Deployed [subgraph](https://thegraph.com/explorer/subgraph/pi0neerpat/mcd-rdai) |
| Roll-your-own rToken         | :white_check_mark: | [docs](#bring-your-own-rtoken)                                                  |
| What else do you need?       | ?                  |                                                                                 |

## Install

```bash
yarn add rtoken-analytics
```

## Usage

```js
import RTokenAnalytics from 'rtoken-analytics';

const MyComponent = () => {
  const from = "0x9492510bbcb93b6992d8b7bb67888558e12dcac4"
  const to = "0x8605e554111d8ea3295e69addaf8b2abf60d68a3"

  const rTokenAnalytics = new RTokenAnalytics();
  const interestSent = await rTokenAnalytics.getInterestSent(from, to);
}
```

If you are using your own rToken subgraph, you will need to provide this info in the arguments.

```js
const options = {
  subgraphURL: 'some other url',
  rdaiSubgraphId: 'some other id'
};
const rTokenAnalytics = new RTokenAnalytics(options);
```

|    Arguments     | Default value                                    |
| :--------------: | ------------------------------------------------ |
|  `subgraphURL`   | `https://api.thegraph.com/subgraphs/id/`         |
| `rdaiSubgraphId` | `QmfUZ16H2GBxQ4eULAELDJjjVZcZ36TcDkwhoZ9cjF2WNc` |

## API

### `getAllOutgoing(address)`

Get all loans where interest is being sent to another address

Returns array of active loans. Example:

```js
[
  {
    amount: '0.50000000058207661',
    hat: {id: '11'},
    recipient: {id: '0x358f6260f1f90cd11a10e251ce16ea526f131b02'}
  },
  {
    amount: '24.49999999941792339'
    // ...
  }
];
```

### `getAllIncoming(address)`

Get all loans where interest is being received from another address

Returns array of active loans (same schema as above)

### `getInterestSent(fromAddress, toAddress)`

Get the total amount of interest sent

Returns: value in DAI

> What other features do you want? Let us know by making an issue.

## Bring-your-own rToken

If you deploy your own token, and you wish to use this SDK, you will need to deploy you own subgraph. As long as you didn't modify the [rToken contracts](https://github.com/rtoken-project/rtoken-contracts) too much, you can just deploy the subgraph in the [`/subgraph`]('subgraph/') folder. Be sure to modify `subgraph.yaml` with the correct `address` and `startBlock`.

## Deploying to a local environment

> :warning: You probably don't need to do this! If your rToken is deployed to `Mainnet` or `Ropsten`, and you are using the standard rToken contracts, then you should use the hosted servers provided by The Graph.

The rToken team uses a local subgraph deployment to enable rapid development and testing of the tools provided here. In this section we will do the following:

1. Deploy the `rtoken-analytics` subgraph to a local docker container on your machine.
2. Deploy the rToken contracts to a local Ganache instance.
3. Check that your setup is correct by running some tests

### Setup a local subgraph

> If you've previously performed the setup process, you should skip down to the [Testing and restarting](#Testing-and-restarting) section.

If you get stuck during setup, see additional instructions from The Graph docs [here](https://thegraph.com/docs/quick-start#local-development).

First install the dependencies

```bash
sudo apt install docker docker-compose
yarn global add truffle ganache-cli @graphprotocol/graph-cli
```

Download the `graph-node` Docker instance.

```bash
git clone https://github.com/graphprotocol/graph-node/
cd graph-node/docker
```

If on Linux, run the following script. Note I had problems here, so you may need to troubleshoot by first running `docker-compose create` or `docker-compose up`. If you get a "version" error, update your docker-compose with [these instructions](https://docs.docker.com/compose/install/). If you get an error like `ERROR: could not find an available, non-overlapping IPv4 address...` then take off your tin-foil hat and stop running OpenVPN, or follow [this tutorial](https://stackoverflow.com/questions/45692255/how-make-openvpn-work-with-docker).

```bash
sudo apt install jq # if necessary
./setup.sh
```

Now lets start our subgraph Docker instance.

```bash
docker-compose up
# leave running
```

In a new terminal, switch back to the `rtoken-analytics` repo, and start running ganache-cli.

```bash
yarn start_ganache
# leave running
```

In a new terminal, we can fetch the latest contracts from the `rtoken-contracts` repo, and deploy them to ganache.

```bash
yarn fetch_contracts
yarn deploy_contracts
```

The address in `rtoken-analytics/subgraph/subgraph.yaml` should be automatically updated during the previous step. Before proceeding, check that the deployed rToken address printed at the start of the deployment process matches the one shown in the .yaml file.

We are now ready to deploy our subgraph.

```bash
cd subgraph
yarn create-local  # Only needs to be run the first time
yarn deploy-local
```

Great job! Now let's make sure things are working properly by doing a sanity check using Postman, or other API tool.

| Property     | value                                                                  |
| ------------ | ---------------------------------------------------------------------- |
| URL          | `http://localhost:8000/subgraphs/name/rtoken-project/rtoken-analytics` |
| Request type | POST                                                                   |
| body         | GraphQL                                                                |

```graphql
query {
  users(first: 5) {
    id
    sentAddressList
    receivedAddressList
  }
}
```

You should get a response like this

```js
{
    "data": {
        "users": [
            {
                "id": "0x1eeee046f7722b0c7f04ecc457dc5cf69f4fba99",
                "receivedAddressList": [
                    "0xbf44e907c4b6583d2cd3d0a0c403403bb44c4a3c",
                    "0xbf44e907c4b6583d2cd3d0a0c403403bb44c4a3c",
                    "0xbf44e907c4b6583d2cd3d0a0c403403bb44c4a3c"
                ],
                "sentAddressList": []
            },
            ...
```

:tada: Congrats! if you were successful with the initial setup, you can move to the next section to enable automatic redeployments of the subgraph upon changes.

### Testing and restarting

Here are the current steps to fully automate :zap: subgraph re-deployment and testing upon changes to the subraph.

In the repo `graph-node/docker`, stop your docker instance, and restart it.

```bash
sudo rm -rf data && docker-compose up

```

Open a new terminal, at the root directory of this repository.

```bash
yarn start_ganache
# leave running
```

In a new terminal, deploy the contracts. This will also re-deploy the new subgraph, whenever subgraph.yaml is changed.

```bash
yarn start_subgraph
# leave running
```

In a new terminal, start the test suite

```bash
nodemon -x yarn test_local
# leave running
```

# Misc. tools

## Get the Compound Interest Rate

This is one method for obtaining the Compound interest rate in your dapp.

```js
import axios from 'axios';

const COMPOUND_URL = 'https://api.compound.finance/api/v2/ctoken?addresses[]=';
const daiCompoundAddress = '0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643';

const getCompoundRate = async () => {
  const res = await axios.get(`${COMPOUND_URL}${daiCompoundAddress}`);
  const compoundRate = res.data.cToken[0].supply_rate.value;
  const compoundRateFormatted = Math.round(compoundRate * 10000) / 100;

  return {
    compoundRate,
    compoundRateFormatted
  };
};
```

Then use it like this

```js
const {compoundRate, compoundRateFormatted} = await getCompoundRate();

console.log(`Compound Rate: ${compoundRateFormatted}%`);
// > Compound Rate: 4.56%

// Recommend you save the rate for quick reference, as the API can be slow.
if (typeof window !== 'undefined') {
  localStorage.setItem('compoundRate', compoundRate);
}
```

# Contributing

Contributions, suggestions, and issues are welcome. At the moment, there are no strict guidelines to follow.
