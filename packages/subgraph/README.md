# rToken Subgraph

> :warning: Warning: While the deployed version is stable, the code in this package is under active development. Please contact the team if you have questions via twitter/discord.

## What you can do:

#### Use it now

Subgraph for rDAI on mainnet is provided by TheGraph, and can be found [at this link](https://thegraph.com/explorer/subgraph/pi0neerpat/mcd-rdai).

#### Develop it

See [Local development](#local-development).

#### Use it with your own rToken

See [Bring-your-own rToken](#bring-your-own-rtoken).

## Local development

> :warning: You probably don't need to do this! If your rToken is deployed to `Mainnet` or `Ropsten`, and you are using the standard rToken contracts, then you should just use the hosted version provided by The Graph.

The rToken team uses a local subgraph deployment to enable rapid development and testing of the tools provided here. In this section we will do the following:

1. Deploy the subgraph to a `docker container`.
2. Deploy the rToken contracts to `Ganache`.
3. Check that your setup is correct by running some `tests`.

### Initial setup

#### Notes:

- If you've already performed this step, you should skip down to the [Testing and restarting](#testing-and-restarting).
- If you get stuck, see The Graph [docs](https://thegraph.com/docs/quick-start#local-development).

First install the dependencie: [docker](https://docs.docker.com/install/) and [docker-compose](https://docs.docker.com/compose/install/)

Install the necessary packages:

```bash
yarn global add truffle ganache-cli @graphprotocol/graph-cli
```

Download the `graph-node` Docker instance.

```bash
git clone https://github.com/graphprotocol/graph-node/
cd graph-node/docker
```

If on Linux, run the following script.

> Note I had problems here, so you may need to troubleshoot by first running `docker-compose create` or `docker-compose up`. If you get a "version" error, update your docker-compose with [these instructions](https://docs.docker.com/compose/install/). If you get an error like `ERROR: could not find an available, non-overlapping IPv4 address...` then try turning off OpenVPN, or follow [this tutorial](https://stackoverflow.com/questions/45692255/how-make-openvpn-work-with-docker).

```bash
sudo apt install jq # if necessary
./setup.sh
```

Now lets start our subgraph Docker instance.

```bash
docker-compose up
# leave running
```

#### Deploy the contracts to Ganache

In a new terminal, navigate to `@rtoken/contracts` and start running ganache-cli and deploy the contracts.

```bash
ganache-cli -h 0.0.0.0 -m 'deputy taste judge cave mosquito supply hospital clarify argue aware abuse glory'
# using the same mnemonic allows for hard-coding the address in `subgraph.yaml` and the test files. It's not the best way, but it works!

# Then in a new terminal
truffle test --network subgraph test/subgraphDeployment.test.js
```

Copy the deployed rToken contract address printed at the start of the deployment process. If you used the same mnemonic, then this step isn't necessary

```
> truffle test --network subgraph test/subgraphDeployment.test.js
...
The rTOKEN contract (proxy) is deployed at: 0xc97EeFc57dD8E74A30AC2cC52E8785B40a14a30c
```

#### Deploy the Subgraph

Navigate back to this package and paste the contract address in `subgraph.yaml`. We are now ready to deploy our subgraph.

```bash
yarn codegen
yarn create-local  # Only run once
yarn deploy-local
```

Great job! Now let's make sure things are working properly by doing a sanity check using Postman, or another API tool.

| Property     | value                                              |
| ------------ | -------------------------------------------------- |
| URL          | `http://localhost:8000/subgraphs/name/rtoken-test` |
| Request type | POST                                               |
| body         | GraphQL                                            |

```graphql
query {
  accounts(
    first: 1000
    where: { id_not: "0x0000000000000000000000000000000000000000" }
  ) {
    id
    balance
    hat {
      id
    }
  }
}
```

You should get a response like this

```js
{
    "data": {
        "accounts": [
            {
                "balance": "0",
                "hat": null,
                "id": "0x0000000000000000000000000000000000000000"
            },
            {
                "balance": "90.001030003030003391",
                "hat": null,
                "id": "0xbf44e907c4b6583d2cd3d0a0c403403bb44c4a3c"
            }
        ]
    }
}
```

:tada: Congrats! if you were successful with the initial setup, you can move to the next section to enable automatic redeployments of the subgraph upon changes.

### Testing and restarting

Once you've completed the initial setup, here is the flow for testing and restarting your subgraph.

1. In the repo `graph-node/docker`, stop your docker instance, and restart it:

```bash
sudo rm -rf data && docker-compose up

```

2. Deploy the contracts to ganache (if needed)

3. Re-deploy the new subgraph, whenever subgraph.yaml is changed:

```bash
yarn deploy-local --watch
```

## Bring-your-own rToken

If you deploy your own token, and wish to use this subgraph with `@rtoken/utils` to get data, you will need to deploy you own subgraph. As long as you didn't modify the rToken contracts too much, you can probably deploy as-is. Be sure to modify `subgraph.yaml` with the correct `address` and `startBlock`.

# Contributing

Contributions, suggestions, and issues are welcome. At the moment, there are no strict guidelines to follow.
