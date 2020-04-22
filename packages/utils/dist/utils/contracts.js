(function (global, factory) {
  if (typeof define === "function" && define.amd) {
    define(['module', '@rtoken/contracts/build/contracts/ERC20.json', '@rtoken/contracts/build/contracts/rDAI.json'], factory);
  } else if (typeof exports !== "undefined") {
    factory(module, require('@rtoken/contracts/build/contracts/ERC20.json'), require('@rtoken/contracts/build/contracts/rDAI.json'));
  } else {
    var mod = {
      exports: {}
    };
    factory(mod, global.ERC20, global.rDAI);
    global.contracts = mod.exports;
  }
})(this, function (module, erc20, rDAI) {
  'use strict';

  const CONTRACTS = {
    sai: {
      abi: erc20.abi,
      kovan: '0xbF7A7169562078c96f0eC1A8aFD6aE50f12e5A99',
      homestead: '0x89d24A6b4CcB1B6fAA2625fE562bDD9a23260359'
    },
    rsai: {
      abi: rDAI.abi,
      kovan: '0xea718e4602125407fafcb721b7d760ad9652dfe7',
      homestead: '0xea8b224eDD3e342DEb514C4176c2E72Bcce6fFF9'
    },
    dai: {
      abi: erc20.abi,
      kovan: '0x4F96Fe3b7A6Cf9725f59d353F723c1bDb64CA6Aa',
      homestead: '0x6B175474E89094C44Da98b954EedeAC495271d0F'
    },
    rdai: {
      abi: rDAI.abi,
      kovan: '0x462303f77a3f17Dbd95eb7bab412FE4937F9B9CB',
      homestead: '0x261b45D85cCFeAbb11F022eBa346ee8D1cd488c0'
    }
  };
  module.exports = CONTRACTS;
});