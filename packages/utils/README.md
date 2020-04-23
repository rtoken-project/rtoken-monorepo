<p align="center"><img src="https://rdai.money/images/logo.svg" width="160"/></p>

<p align="center">
    <a href="https://www.npmjs.com/package/@rtoken/contracts">
        <img alt="npm" src="https://img.shields.io/npm/v/@rtoken/contracts">
    </a>
    <img alt="GitHub" src="https://img.shields.io/github/license/rtoken-project/rtoken-contracts">
</p>

# @rtoken/utils

This library provides tools for getting rDAI and rToken data into your dapp.

> NOTE: This package was formerly named `rtoken-analytics`. See the archived repo [here](https://github.com/rtoken-project/rtoken-analytics).

> :warning: Warning: the code in this package is under active development. Please contact the team if you have questions via twitter/discord.

# Usage

#### 1. Connect to the Data :raised_hands: :rainbow:

This will be your connection to the rToken subgraph (`../packages/subgraph`), which provides the blockchain data.

```js
import { getClient } from '@rtoken/utils';
const apolloInstance = getClient();
```

You can configure your client by passing an object to `getClient()` with the following:

| option | default                     | description                      |
| ------ | --------------------------- | -------------------------------- |
| uri    | (mainnet rDAI subgraph URL) | Location of your rToken subgraph |
| debug  | `false`                     | Display logs on Apollo errors    |

If you want even more control you can instantiate the Apollo client yourself (see [Using your own Apollo client](#Using-your-own-Apollo-client)).

#### 2. Instantiate the `RTokenUtils` library and use

```js
import RTokenUtils, { getClient } from '@rtoken/utils';

const apolloInstance = getClient();
const rutils = new RTokenUtils(apolloInstance, options);
```

You can change the default configuration by passing an additional object to the constructor with the following:

| option | default | description  |
| ------ | ------- | ------------ |
| debug  | `false` | print errors |

#### 3. Create and use your objects

Users, Hats, and Global objects are available for inspecting.

```js
// Users
const userA = rutils.user({ address: '0xabc...' });
const interestSent = userA.sentInterestTo('0xbca...');

// Hats
const myHat = rutils.hat(11);
const totalInterest = myHat.totalInterestSent();

// Global
const rDAIGlobal = rutils.global();
const globalInterest = rDAIGlobal.totalInterestSent();
```

If you have any questions, please contact us via Discord.

### Using your own Apollo client

This might be helpful if you want more control over the apollo-client, such as custom caching options or authentication of a private client. See `/src/utils/client` for how we instantiate the client.

```js
const { ApolloClient } = require('apollo-client');
const { InMemoryCache } = require('apollo-cache-inmemory');
const { HttpLink } = require('apollo-link-http');
const fetch = require('cross-fetch');

const cache = new InMemoryCache();
const link = new HttpLink({
  uri: 'http://localhost:4000/',
  fetch,
});

const apolloInstance = new ApolloClient({
  link,
  cache,
  onError: (e) => {
    console.log(e);
  },
  defaultOptions: {
    query: {
      fetchPolicy: 'network-only',
    },
  },
});
```

# Deprecated old usage

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

If you are using your own rToken subgraph, provide the information in the constructor.

|    Arguments     | Default value                                    |
| :--------------: | ------------------------------------------------ |
|  `subgraphURL`   | `https://api.thegraph.com/subgraphs/id/`         |
| `rdaiSubgraphId` | `QmfUZ16H2GBxQ4eULAELDJjjVZcZ36TcDkwhoZ9cjF2WNc` |

```js
const options = {
  subgraphURL: 'some other url',
  rdaiSubgraphId: 'some other id',
};
const rTokenAnalytics = new RTokenAnalytics(options);
```

## API

### `getAllOutgoing(address)`

Get all loans where interest is being sent to another address

Returns array of active loans. Example:

```js
[
  {
    amount: '0.50000000058207661',
    hat: { id: '11' },
    recipient: { id: '0x358f6260f1f90cd11a10e251ce16ea526f131b02' },
  },
  {
    amount: '24.49999999941792339',
    // ...
  },
];
```

### `getAllIncoming(address)`

Get all loans where interest is being received from another address

Returns array of active loans (same schema as above)

### `getInterestSent(fromAddress, toAddress)`

Get the total amount of interest sent

Returns: value in DAI

> What other features do you want? Let us know by making an issue.

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
    compoundRateFormatted,
  };
};
```

Then use it like this

```js
const { compoundRate, compoundRateFormatted } = await getCompoundRate();

console.log(`Compound Rate: ${compoundRateFormatted}%`);
// > Compound Rate: 4.56%

// Recommend you save the rate for quick reference, as the API can be slow.
if (typeof window !== 'undefined') {
  localStorage.setItem('compoundRate', compoundRate);
}
```

# Contributing

Contributions, suggestions, and issues are welcome. At the moment, there are no strict guidelines to follow.
