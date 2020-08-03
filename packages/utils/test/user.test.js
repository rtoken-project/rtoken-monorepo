// var test = require('mocha').describe;
// var assert = require('chai').assert;
import { ethers } from "ethers";
const { formatUnits } = ethers.utils;
var expect = require("expect.js");

import { getRutils } from "./utils/general";
import { getUsers } from "./utils/users";
import { getRTokenContract } from "./utils/web3";

const rutils = getRutils();
const users = getUsers();
const { customer1, customer2, customer3 } = users;
let rtoken;

before(async () => {
  rtoken = await getRTokenContract();
});

describe("Tests basic user lookup", () => {
  it("should successfully get account by address", async () => {
    const user = rutils.user({
      address: customer2.address,
    });
    const details = await user.details();
    expect(details.id).to.be(customer2.address);
  });
  it("should successfully get account rToken balance", async () => {
    const balanceBn = await rtoken.balanceOf(customer2.address);
    const balance = formatUnits(balanceBn, 18);
    const user = rutils.user({
      address: customer2.address,
    });
    const details = await user.details();
    expect(details.balance).to.be(balance);
  });
});

// test('RTokenAnalytics', async (accounts) => {
//   let rtokenAnalytics;
//
//   before(async () => {
//     let compoundRate = debug.hardCodeInterestRate;
//     if (!debug.hardCodeInterestRate) {
//       compoundRate = await getCompoundRate();
//     }
//
//     console.log('Subgraph URL     : ', subgraphURL);
//     console.log('Subgraph ID rDAI : ', rdaiSubgraphId);
//     console.log(
//       'Local test       : ',
//       typeof isLocal === 'undefined' ? false : true
//     );
//
//     const web3Provider = new ethers.providers.InfuraProvider(
//       'homestead',
//       process.env.INFURA_ENDPOINT_KEY
//     );
//
//     const options = {
//       interestRate: compoundRate, // Currently unused
//       interestTolerance, // Currently unused
//       rdaiSubgraphId,
//       subgraphURL,
//       web3Provider,
//     };
//     rtokenAnalytics = new RTokenUtils(options);
//   });
//
//   it('getAllOutgoing()', async () => {
//     let outgoing = await rtokenAnalytics.getAllOutgoing(userA);
//     assert.isAbove(outgoing.length, 0, 'no outgoing were returned');
//   });
//
//   it('getAllIncoming()', async () => {
//     let incoming = await rtokenAnalytics.getAllIncoming(userB);
//     assert.isAbove(incoming.length, 0, 'no incoming were returned');
//   });

// it('getInterestSent()', async () => {
//   let interestSent = await rtokenAnalytics.getInterestSent(userA, userB);
//   let interest = new BigNumber(interestSent);
//   console.log('interest sent    : ', interest.toNumber());
//   assert.isOk(interest.isGreaterThan(0), 'no interest has been paid');
// });

// it('getTotalInterestPaid()', async () => {
//   let totalInterestPaid = await rtokenAnalytics.getTotalInterestPaid(userC);
//   let interest = new BigNumber(totalInterestPaid);
//   assert.isOk(interest.isGreaterThan(0), 'no interest has been paid');
// });
