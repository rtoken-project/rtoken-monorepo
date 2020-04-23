// import { ethers } from 'ethers';

const users = {
  admin: { address: '0x1EEEe046f7722b0C7F04eCc457Dc5CF69f4fbA99' },
  bingeBorrower: { address: '0x7169A64CbF5E2dF1d5E55615aa1C3b6394d36471' },
  customer1: { address: '0xbF44E907C4B6583d2cD3d0a0C403403BB44c4A3C' },
  customer2: { address: '0x9C221bF5EdA23267b43C269959c36534628b49CF' },
  customer3: { address: '0xFF41f7C0C5002cac833Dd9058C43B92b29137bDA' },
};

export const getUsers = () => {
  Object.keys(users).forEach((user) => {
    users[user].address = users[user].address.toLowerCase();
    // const wallet = ethers.Wallet.fromMnemonic(users[user].mnemonic);
    // users[user].wallet = wallet;
  });
  return users;
};

// export const deleteTestUsers = async (prisma) => {
//   await Promise.all(
//     Object.keys(users).map(async (user) => {
//       const id = await prisma
//         .wallet({ address: users[user].address })
//         .owner()
//         .id();
//       if (id) {
//         await prisma.deleteUser({ id: id });
//         console.log(`Test user "${user}": Deleted!`);
//       } else {
//         console.log(`Test user "${user}": Not found`);
//       }
//     })
//   );
//   return;
// };
