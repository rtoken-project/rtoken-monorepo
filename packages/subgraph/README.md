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

## Bring-your-own rToken

If you deploy your own token, and wish to use this subgraph with `@rtoken/utils` to get data, you will need to deploy you own subgraph. As long as you didn't modify the rToken contracts too much, you can probably deploy as-is. Be sure to modify `subgraph.yaml` with the correct `address` and `startBlock`.

# Contributing

Contributions, suggestions, and issues are welcome. At the moment, there are no strict guidelines to follow.
