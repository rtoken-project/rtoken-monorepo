import ethers from 'ethers';
import CONTRACTS from '../utils/contracts';

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

export { getContract, getWeb3Provider };
