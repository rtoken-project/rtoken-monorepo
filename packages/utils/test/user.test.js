// var test = require('mocha').describe;
// var assert = require('chai').assert;

import { parseUnits, formatUnits } from "@ethersproject/units";
var expect = require("expect.js");

import { getRutils } from "./utils/general";
import { getUsers } from "./utils/users";
import { getRTokenContract } from "./utils/web3";

const rutils = getRutils();
const users = getUsers();
const { customer1, customer2, customer3 } = users;
let rtoken;
let user2;

before(async () => {
  rtoken = await getRTokenContract();
});

describe("Tests basic user lookup", () => {
  it("should successfully get account by address", async () => {
    user2 = rutils.user(customer2.address);
    const details = await user2.details();
    expect(details.id).to.be(customer2.address);
  });
  it("should successfully get account rToken balance", async () => {
    const balance = formatUnits(await rtoken.balanceOf(customer2.address), 18);
    const details = await user2.details();
    expect(details.balance).to.be(Math.round(balance).toString());
  });
  it("should successfully get account interest sent to recipient", async () => {
    const accountStats = await rtoken.getAccountStats(customer3.address);
    const cumulativeInterest = accountStats.cumulativeInterest;

    const interestSent = await user2.interestSent(customer3.address);
    expect(formatUnits(cumulativeInterest, 18)).to.be.greaterThan(interestSent);
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
