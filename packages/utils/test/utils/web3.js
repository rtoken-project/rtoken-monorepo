import { ethers } from 'ethers';
import RToken from '@rtoken/contracts/build/contracts/RToken';

const RTOKEN_ADDRESS = '0xA0E2aEAd993c21c118324c2BCC214e0f9aCA5796';

const getWeb3Provider = () => {
  try {
    const web3Provider = new ethers.providers.JsonRpcProvider(
      'http://localhost:8545'
    );
    return web3Provider;
  } catch (error) {
    console.log('error setting up web3 provider: ', error);
    return;
  }
};

export const getRTokenContract = async () => {
  const contract = new ethers.Contract(
    RTOKEN_ADDRESS,
    RToken.abi,
    getWeb3Provider()
  );
  return contract;
};
