(function (global, factory) {
  if (typeof define === "function" && define.amd) {
    define(['module', 'ethers', '../utils/contracts'], factory);
  } else if (typeof exports !== "undefined") {
    factory(module, require('ethers'), require('../utils/contracts'));
  } else {
    var mod = {
      exports: {}
    };
    factory(mod, global.ethers, global.contracts);
    global.web3 = mod.exports;
  }
})(this, function (module, ethers, CONTRACTS) {
  'use strict';

  const getWeb3Provider = (network, infuraKey) => {
    try {
      const web3Provider = new ethers.providers.InfuraProvider(network, infuraKey);
      return web3Provider;
    } catch (error) {
      console.log('error setting up web3 provider: ', error);
      return;
    }
  };

  const getContract = async name => {
    const contract = new ethers.Contract(CONTRACTS[name][undefined.network], CONTRACTS[name].abi, undefined.web3Provider);
    return contract;
  };

  module.exports = { getContract, getWeb3Provider };
});