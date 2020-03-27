### General

Call handlers can subscribe to functions rather than events, but not available on Rinkeby or Ganache (due to lack of Parity tracing API)

### Commands

test if the mapping is correct with

`yarn build`

Generate the output with

`yarn codegen`

## Other tools

sweet set up that generates a subgraph.yaml dynamically with a handlebars template

Oh, it's so you can keep multiple subgraphs on the same git branch
Imagine you want to deploy to both Mainnet and Kovan
What you normally do is either swap the contract addresses and network name just for deployment purposes and then revert, OR you keep different branches
Both solutions are janky and slow down development
With a template, you can run deployments like this:

- yarn run deploy:mainnet
- yarn run deploy:kovan

https://github.com/sablierhq/sablier-subgraph/blob/master/subgraph.template.yaml

Auto-deploy subgraph
https://github.com/sablierhq/sablier-subgraph/blob/master/.github/workflows/deploy.yml



TODO: add the correct ganache address to the truffle config file in this repo.
Also add the contracts- pull from external or no?

- Add contract to schema.graphql
- Add user address to `test/rtokenAnalytics.test.js`
- add

3. Start

## Discussion on loan tracking with Miao

Question: How much interest (rDAI/DAI, what if it is cDAI) Alice has earned thanks to Bob?

Bob mints 10 rDAI, Alice is one recipient

LoanTransfered(bob → alice, isDistribution = true, 10 DAI, 100 cDAI (10 DAI))

Alice’s account info: 10 rDAI, 100 cDAI (worths 10 DAI)

100 cDAI = 100 cDAI (owed to Bob effectively) + 0 cDAI (owned by Alice fully)

.... eons later ...

Alice’s account info: 10 rDAI, 100 cDAI (worths 11 DAI)

100 cDAI = 91 cDAI (owed to Bob effectively) + 9 cDAI (owned by Alice fully)

… more eons later ...

100 cDAI = 1 cDAI (owed to Bob effectively) + 99 cDAI (owned by Alice fully)

--- Alice earned 1 rDAI from Bob's contribution

Bob redeems 5 rDAI

LoanTransfered(bob ← alice, isDistribution = false, 5 DAI, 45 cDAI );

-5 DAI -45 cDAI

Alice’s account info: 5 rDAI, 55 cDAI (worths 6 DAI)

--- Alice earned (6-5) = 1 rDAI from Bob’s contribution

Bob redeems 10 rDAI

LoanTransfered(bob ← alice, isDistribution = false, 10 DAI, 91 cDAI );

-10 DAI -91 cDAI

Alice’s account info: 0 rDAI, 9 cDAI (worths 1 DAI)

---

From this moment forward, Bob’s contribution to Alice is no longer calculated.

Bob transfers 10 rDAI to Jack, who doesn’t contribute to Alice

LoanTransfered(bob ← alice, isDistribution = false, 10 DAI, 91 cDAI );
LoanTransfered(bob → jack, isDistribution = true, 10 DAI, 91 cDAI );

Alice pays all interest

Alice’s account info: 1 rDAI, 9 cDAI (worths 1 DAI)

Alice redeems all

Alice’s account info: 0 rDAI, 0 cDAI

```

```
