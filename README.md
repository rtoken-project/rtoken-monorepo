RToken Ethereum Contracts
=========================

`RToken`, or Reedemable Token, is an _ERC20_ token that is 1:1 redeemable to
its underlying _ERC20_ token. The underlying tokens are invested into interest
earning assets specified by the saving strategy, for example into compound
finance. Owners of the _rTokens_ can use a definition called _hat_ to configure
to whom the accumulated interests are going to. _RToken_ can be used for
community fund, charity, crowdfunding, etc. It is also a building block for
_DApps_ that need to lock underlying tokens while not losing their earning
potentials.

## How does it work

As an example, let's pick [_DAI_](https://dai.makerdao.com/) as our underlying
token contract. As a result, the _rToken_ instantiation is conveniently called
_rDai_ in this example.

### 1. Hat Types

A hat defines whom the _dai_ is loaned to, and the earned interest are kept by.
Every address can be configured with one and only one hat.

There are two hats:

* `Zero Hat` - It is the default hat for all addresses, where _dai_ tokens
locked by the owner is loaned to the owner itself. It is subjected to the _Hat
Inheritance Rules_

* `Self Hat` - Similar to the _Zero Hat_, the owner keeps all _dai_ tokens to
itself. However, it is a deliberate choice by the owner, hence the _Hat
Inheritance Rules_ does not apply to the address.

### 2. Hat Definition

A _hat_ is defined by a list of recipients, and their relative proportions for
splitting the _rDai_ loans from the owner.

For example:
```
{
    recipients: [A, B],
    proportions: [90, 10]
}
```
defines that the _dai_ tokens will be loaned to address A and address B in the
relative proportions of 90:10, effectively A receives 90% and B receives 10% of
the loan.

### 3. Mint

Owner first needs to approve the _rDAI_ contract to use its _dai_ tokens, then
the owner can mint as much as _rDAI_ as it has. One _rDai_ is always one _dai_.

As a result, the _dai_ tokens transferred for minting new _rDai_ tokens are
loaned to the recipients according to the the hat of the owner.

### 4. Redeem

The owner may redeem the _dai_ tokens any time it wishes by transferring back
the _rDai_ tokens it has.

As a result, the loaned _dai_ tokens are recollected from the recipients, and
given back to the owner.

### 5. Transfer

_RDai_ contract is _ERC20_ compliant, and one should use _ERC20_ _transfer_ or
_approve_ functions to transfer the _rDai_ tokens between addresses.

As a result, amount of _dai_ tokens loaned out by the source relevant to the
transaction is recollected, and loaned to the new recipients according to the
hat of the destination.

### 6. Pay Interest

Recipients of loaned _dai_ tokens are entitled to the full amount of interest earned from them.

Anyone could transfer to the _payInterest_ function, which converts the
earned interest to the new _rDai_ tokens. It is done so so that contract
addresses can also be the recipients, despite not having implemented functions
to call the _payInterest_ function externally.

Unlike the mint processes, _rDai_ generated in this process does not loan equal
amount of _dai_ tokens to any recipient. The owner may choose to loan them by
using _loanInterest_, or transfer the _rDai_ to another address and triggers
the hat switching process.

A interest payment rules may apply as per configuration (see _Governance
section_).

### 6. Hat Inheritance Rules

In order to maximize the cause of the hat owners choose, the following rules are
stipulated to allow more addresses to have the most "popular" hat:

* All addresses have the _Zero Hat_ by default.

* During mint processes, _dai_ tokens are loaned to the recipients. If the
recipient has the _Zero Hat_, the recipient will inherit the minter's hat.

* During the transfer process, _dai_ tokens are recollected and loaned to
the new recipients. If the recipient has the _Zero Hat_, the recipient will
inherit the source's hat.

* It is up to the circumstances that who is deemed actual owner of any contract.
Therefore, `rToken` leaves a possibility that the admin could change hat for any
contract address. Note that the addresses without code is assumed to be able to
demonstrate the ownership by indisputable ownership of the private key, so even
_admin_ is not allowed to change that for them.

### 7. Governance

`RToken` contract has a admin role who can:

- Configure saving strategy
- Configure interest payment rules:
  - Minimal threshold of "interest amount / loaned tokens"
  - Minimal period before first interest payment
  - Minimal gap between interest payments
- Change hat for any contract address

It is up to  the `rToken` instantiator to decide the degree of the
decentralization. For maximum decentralization, the admin could be a DAO that is
implemented by a DAO framework such as [Aragon](https://aragon.org/), and the
hat change could be controlled by a arbitration DAO such as
(Kleros)(https://kleros.io/).
