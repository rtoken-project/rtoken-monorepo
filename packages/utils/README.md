<p align="center"><img src="https://rdai.money/images/logo.svg" width="160"/></p>

<p align="center">
    <a href="https://www.npmjs.com/package/@rtoken/contracts">
        <img alt="npm" src="https://img.shields.io/npm/v/@rtoken/contracts">
    </a>
    <img alt="GitHub" src="https://img.shields.io/github/license/rtoken-project/rtoken-contracts">
</p>

# @rtoken/utils

> Easy to use library for fetching rDAI / rToken data for your Dapp.

# What does it do?

This library wraps the rDAI subgraph, so you can make simple calls. It supports rDAI on Mainnet, Kovan, but you can also bring your own subgraph.

```js
const user = rutils.user("0xaaa...");
console.log(await user.interestSentTo("0xbbb..."));
// > 1.230495
console.log(await user.interestReceivedList());
// >
[
  {
    sender: "0x0efe994201e2b0136dd40d5033b5f437e4c5f958", // Who sent the interest
    amount: "100.000000000000000000", // Amount of rDAI the sender is using to generate interest for this user
    interestRedeemed: "0.07179777866578322382540442607287171", // Amount of rDAI this user has redeemed from the sender
    interestSent: 2.683831612180583, // Sum of interestRedeemd and all outstanding interest (unredeemed) from the sender
    sInternal: "10.000000012701007569669278674669046802622" // Internal Savings Asset for this loan
  }
];
```

# Getting started

#### 1. Connect to the Data :raised_hands: :rainbow:

This will be your connection to the rToken subgraph, which provides the blockchain data. Use the helper function to set it up, or see [Using your own Apollo client](#Using-your-own-Apollo-client).

```js
import {getClient} from "@rtoken/utils";

const apolloInstance = getClient(); // Defaults to mainnet/homestead

// OR

const apolloInstance = getClient({network: "kovan"});
```

Available options:

| option    | default   | description                                 |
| --------- | --------- | ------------------------------------------- |
| `network` | homestead | Must be homestead or kovan                  |
| `url`     | n/a       | Useful if you have your own custom subgraph |
| `debug`   | false     | Display logs on Apollo errors               |

You also need an `Ethers.js v5` web3 provider instance. If you only care about the interest that's actually been redeemed, then you do not need this.

```js
import {InfuraProvider} from "@ethersproject/providers";

const web3Provider = new InfuraProvider("kovan", process.env.INFURA_KEY);
```

#### 2. Instantiate the @rtoken/utils library

Pass the `apolloInstance` to create the `RTokenUtils` object.

```js
import RTokenUtils, {getClient} from "@rtoken/utils";

const rutils = new RTokenUtils(apolloInstance, web3Provider, {
  network: "kovan"
});
```

Available options:

| option    | default   | description                |
| --------- | --------- | -------------------------- |
| `network` | homestead | Must be homestead or kovan |
| `debug`   | false     | Display logs               |

#### 3. Create and use your entities

Create User and Hat objects

```js
// Users
const user = rutils.user("0xabc...123");
const userDetails = await user.details();

// Hats
const myHat = rutils.hat(11);
const allUsers = await myHat.allUsers();
```

If you have any questions, please contact us via Discord.

## API

### Major Entities

#### `rutils.user(address)`

#### `rutils.hat(hatID)`

### :bust_in_silhouette: User

If you are not using a Web3 Provider, then you must always set `redeemedOnly` to `true`.

When `redeemedOnly` is `true` the response will only include the amount of redeemed interest. The list response (eg. `interestSentList`) will not include `interestSent`.

#### `user.details()`

Returns details about an account, including balance.

#### `user.interestSentTo(recipient[, redeemedOnly])`

Returns amount of interest sent from the user to a recipient.

| Argument     | Type    | default  |
| :----------- | :------ | -------- |
| recipient    | Address | required |
| redeemedOnly | Boolean | false    |

#### `user.interestSentList([redeemedOnly])`

Returns a list of every recipient the user has ever sent interest to.

| Argument     | Type    | default |
| :----------- | :------ | ------- |
| redeemedOnly | Boolean | false   |

example return value:

```json
[
  {
    "amount": "100.000000000000000000", // current amount of rDAI pointed at the recipient
    "interestRedeemed": "0.07179777866578322382540442607287171",
    "recipient": "0x0efe994201e2b0136dd40d5033b5f437e4c5f958",
    "sInternal": "10.000000012701007569669278674669046802622", //
    "interestSent": 2.683831612180583 // Only included if redeemedOnly is false
  }
  //...
]
```

#### `user.interestSentSum([redeemedOnly])`

Returns the sum of all interest from the method `interestSentList()`.

| Argument     | Type    | default |
| :----------- | :------ | ------- |
| redeemedOnly | Boolean | false   |

#### `user.interestReceivedList([redeemedOnly])`

Returns a list of every sender which has ever sent interest to the user.

| Argument     | Type    | default |
| :----------- | :------ | ------- |
| redeemedOnly | Boolean | false   |

Return value is similar to `interestSentList()`

#### `user.interestReceivedSum([redeemedOnly])`

Returns amount of interest received.

| Argument     | Type    | default |
| :----------- | :------ | ------- |
| redeemedOnly | Boolean | false   |

### :tophat: Hat

- `hat.allUsers()`

### Price / Compound Rate data

#### `getCompoundRate()`

Returns the current interest rate for DAI on Compound using the Compound API.

Example return:

```js
{
  rate, // 0.0015121234345343435345
    formattedRate; // 15.12
}
```

#### `getCompoundRateAtBlock()`

Returns the interest rate at a specific block for DAI on Compound using the Compound API.

#### `getEthPrice(web3Provider)`

Returns the current Ethereum price in DAI, using the [Medianizer Contract](https://etherscan.io/address/0x729D19f657BD0614b4985Cf1D82531c67569197B#code). A Web3 Provider is required.

# Additional options

## Using your own Apollo client

This might be helpful if you want more control over the apollo-client, such as custom caching options or authentication of a private client. See `/src/utils/client` for how we instantiate the client.

```js
const {ApolloClient} = require("apollo-client");
const {InMemoryCache} = require("apollo-cache-inmemory");
const {HttpLink} = require("apollo-link-http");
const fetch = require("cross-fetch");

const cache = new InMemoryCache();
const link = new HttpLink({
  uri: "http://localhost:4000/",
  fetch
});

const apolloInstance = new ApolloClient({
  link,
  cache,
  onError: e => {
    console.log(e);
  },
  defaultOptions: {
    query: {
      fetchPolicy: "network-only"
    }
  }
});

const rutils = new RTokenUtils(apolloInstance);
```

# Developing

After installing packages, run the command `yarn get-abis` to pull in the latest contract abis from `@rtoken/contracts`

# Contributing

Contributions, suggestions, and issues are welcome. At the moment, there are no strict guidelines to follow.
