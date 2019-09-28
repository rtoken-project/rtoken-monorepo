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


 ### Notes 2 -

## Changes made

### Variables and storage

Due to the way solidity handles variable declarations, duplicates will be ignored. Thus all variables are placed into the `Storage.sol` contract, which is inherited as the first base contract. This will make variables declared in `Storage.sol` as the "ultimate truth", and any further declaration instances are ignored.

*However*, rather than leave them in place, I decided to remove any obvious duplicate variable declarations, to reduce confusion around multiple declarations. This also will encourage future developers to only place variables in `Storage.sol` and to utilize the rules of variable ordering in proxy contracts.

__Change from Private to Public__: Since the variables are now instantiated in `Storage.sol`, they must be made public to be accessed by `RToken.sol`. One hiccup here is that making `Hat[] private hats` to "public" causes the following error

>TypeError: Internal or recursive type is not allowed for public state variables.

:warning: I have not found a real solution for this yet. The only hot-fix is to include the variable in both `Storage.sol` and `RToken.sol`

__Additional practices__ observed as suggested by OpenZeppelin ([article](https://docs.openzeppelin.com/sdk/2.5/writing-contracts)) and/or EIP 1822.


1. __Initializers rather than "constructor"__

  There is no need for a constructor, but rather a function which performs the similar effect as a constructor.

2. __Avoid initial values in field declarations__

  Since we are removing the use of a constructor, we also need to remove variables which are treated as "constructor-like", such as `myBoolean` in this example. If we do not do this, it will be difficult to change it's value in the future.

    ```solidity
    contract MyContract {
        bool myBoolean = true;

        constructor(){
        //...
        }
    }
    ```
  Instead, the above should be changed to this

    ```solidity
    contract MyContract {
        bool myBoolean;

        intilialize(){
          myBoolean = true;
        }
    }
    ```

  The following variables were impacted:

 `owner`: This can be changed with `transferOwnership()`, so it is not necessary to move this to the `initialize()`.

 `_guardCounter`: It is more likely we would implement a completely different version of ReentrancyGuard, rather than ever need to change this value. In this situation, `_guardCounter` would become deprecated / no longer used. Therefore, this was not moved to `initialize()`.

 `SELF_HAT_ID` and `PROPORTION_BASE`: The compiler does not reserve a storage slot for constants. Therefore, these were not moved to `initialize()`, nor placed in `Storage.sol`. If an upgraded contract is deployed with new constants, the proxy will utilize the new values.

 `name` `symbol` `decimals` `savingAssetConversionRate`: moved to `initialize()`, so they can be changed if needed during a future upgrade.

### Upgradeability

`RToken.sol` inherits `Proxiable.sol` to allow for upgrading

```solidity
contract RToken is Structs, Storage, IRToken, Ownable, Proxiable, LibraryLock, ReentrancyGuard {
```

`updateCode()` provides the pathway to perform an upgrade, restricted to only owner.

```solidity
/// @dev Update the rToken logic contract code
function updateCode(address newCode) external onlyOwner delegatedOnly {
  updateCodeAddress(newCode);
}
```

### Library Lock

Added to prevent potentially harmful calls made directly to the library/logic contract. For now, the only function which needs the `delegatedOnly` modifier is `updateCode()`.

```solidity
contract LibraryLock is Storage {
    // Ensures no one can manipulate the Logic Contract once it is deployed.
    // PARITY WALLET HACK PREVENTION

    modifier delegatedOnly() {
        require(initialized == true, "The library is locked. No direct 'call' is allowed");
        _;
    }
    function initialize() internal {
        initialized = true;
    }
}
```

### Other

__Don't include any `delegatecall` or `selfdestruct`__

  This is important to keep in mind for future upgrades. Never include this functionality, else an attacker can destroy the contracts.

__Compilation warnings__

```solidity
Warning: Unused local variable.
        (bool success, bytes memory _ ) = contractLogic.delegatecall(constructData); // solium-disable-line
                       ^------------^
```
This has been a warning on `Proxy.sol` for a while. Will need to defer to Gabriel if this can be fixed.


```solidity
Warning: Experimental features are turned on. Do not use experimental features on live deployments.
pragma experimental ABIEncoderV2;
^-------------------------------^
```

This was already present before starting my work.


## Upgrade test added & passing :+1:

Test #15 has been added for performing an upgrade. After the upgrade, it simply runs through test #2 again (rToken normal operations with zero hatter). If you want it to run through the entire test suite, simply place the upgrade snippet below in the `beforeEach()`.

```solidity
// Deploy the new rToken logic/library contract
const newRTokenLogic = await web3tx(RToken.new, "RToken.new")(
    {
      from: admin
  });
// Perform the upgrade
await web3tx(rToken.updateCode, "rToken.updateCode")(newRTokenLogic.address, {
  from: admin
});
```

### Other

`Ownable.sol` and `ReentrancyGuard.sol` each have their own "Private" variable declarations when using the imported contracts from OpenZeppelin. Since all the variables are listed as "Public" in `Storage.sol`, this is actually creating two separate variables, or at least it's unclear which is being used. Regardless, I copied the code from these two contracts to import them locally

```solidity
import {Ownable} from "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import {ReentrancyGuard} from "openzeppelin-solidity/contracts/utils/ReentrancyGuard.sol";
// changed to
import {Ownable} from "./Ownable.sol";
import {ReentrancyGuard} from "./ReentrancyGuard.sol";
```

Does the initialize function need to be set to `delegatedOnly` ?
