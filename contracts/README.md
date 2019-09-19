Steps performed:

1. Contract is flattened
2. All variables are moved to `Storage.sol`
3. Each contract that references these variables inherits the Storage contract.

```solidity
contract MyContract is Storage ... {
```

4. LibraryLock.sol contract is added, inherited, and all functions receive modifier `delegateOnly`
5. The Proxiable.sol contract is added, and the parent contract inherits.

<input type="checkbox"/> contractA

<input type="checkbox"/> contractB

<input type="checkbox"/>

Storage Slot string: <input placeholder="Proxiable v1.0.0"></input>

Using the default here makes it easier to identify any proxy contracts on-chain.

### Notes

Started looking at this [function prioritization](https://github.com/HectorZarate/prioritize-truffle-plugin/blob/master/prioritize.js) Truffle plugin from the Trufflecon2019 hackathon.

Its difficult to find the variable, without running [solc compiler](https://github.com/ethereum/solc-js)

Maybe can use [atom solc linter](https://atom.io/packages/atom-solidity-linter)?

[Solidity contract explorer](https://github.com/federicobond/soli). Which is built on top of [Solidity Parser](https://github.com/federicobond/solidity-parser-antlr), which is built on [Solidity ANTLR4](https://github.com/solidityj/solidity-antlr4).

[Soli](https://github.com/federicobond/soli) contract explorer returns all the functions of a contract

Solidity Parser is used in [Truffle Flattener](https://github.com/nomiclabs/truffle-flattener)
[Prettier plugin](https://www.npmjs.com/package/prettier-plugin-solidity)
