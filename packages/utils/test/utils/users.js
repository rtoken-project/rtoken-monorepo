import { ethers } from "ethers";

// const MNEMONIC =
//   'deputy taste judge cave mosquito supply hospital clarify argue aware abuse glory';

const users = {
  admin: {
    address: "0x3dC51366CeB8499C30a26AE8bE282Ac70037D533",
    pk: "0x2ffa82c5648db9e2c7be91de74f909a34417f2d8c0305598aca07f967fd8b476",
  },
  bingeBorrower: {
    address: "0x804b6bd54724bD3b05d9Ec9D7Dd3b297321b2B79",
    pk: "0x34b65abdeb66fbfe1156e33d74919149be27f5545f3e3ec81e44bf76a311e050",
  },
  customer1: {
    address: "0xEa9Ac48d56c9A3465333eF70f769200a514BF969",
    pk: "0x4aaa4add4c71bf53964f2db16fa3f6c9856b2e7a6388b3a3c10397af03717052",
  },
  customer2: {
    address: "0xdf265663574E3F0D1CE5240E223452CEdBD8FAFA",
    pk: "0x5e49ad39b54bb11660b28fbf281c65cc554fe40258187948c01941b50df35c70",
  },
  customer3: {
    address: "0x30F9200C833682C74875766a3B0A9745e55D1a65",
    pk: "0x3a95ea08a77296aa967e636c8ba63ef75ecc864b758482f30e360bc0d56e7c0e",
  },
};

export const getUsers = () => {
  Object.keys(users).forEach((user) => {
    const wallet = new ethers.Wallet(users[user].pk);
    users[user].wallet = wallet;
    users[user].address = users[user].address.toLowerCase();
  });
  return users;
};
