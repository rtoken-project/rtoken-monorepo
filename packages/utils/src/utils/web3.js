const ethers = require('ethers');
const CONTRACTS = require('../utils/contracts');

const getWeb3Provider = (network, infuraKey) => {
  try {
    const web3Provider = new ethers.providers.InfuraProvider(
      network,
      infuraKey
    );
    return web3Provider;
  } catch (error) {
    console.log('error setting up web3 provider: ', error);
    return;
  }
};

const getContract = async (name) => {
  const contract = new ethers.Contract(
    CONTRACTS[name][this.network],
    CONTRACTS[name].abi,
    this.web3Provider
  );
  return contract;
};

module.exports = { getContract, getWeb3Provider };
