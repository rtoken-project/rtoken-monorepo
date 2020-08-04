// var test = require('mocha').describe;
// var assert = require('chai').assert;
import { BigNumber } from "@ethersproject/bignumber";
import { parseUnits, formatUnits } from "@ethersproject/units";
var expect = require("expect.js");

import { getContract } from "../src/utils/web3";

import { getRutils, getWeb3Provider } from "./utils/general";
import { getUsers } from "./utils/users";

const rutils = getRutils();
const { customer1, customer2, customer3 } = getUsers();
let rtoken;
const user1 = rutils.user(customer1.address);
const user2 = rutils.user(customer2.address);
const user3 = rutils.user(customer3.address);

before(async () => {
  rtoken = await getContract("rdai", "local", getWeb3Provider());
});

describe("Tests basic user lookup", () => {
  it("should successfully get account by address", async () => {
    const details = await user2.details();
    expect(details.id).to.be(customer2.address);
  });
  it("should successfully get account rToken balance", async () => {
    const balance = formatUnits(await rtoken.balanceOf(customer2.address), 18);
    const details = await user2.details();
    expect(details.balance).to.be(Math.round(balance).toString());
  });
  it("should successfully return 0 if no interest has been sent", async () => {
    const interestSent = await user2.interestSent(customer1.address);
    expect(interestSent).to.be(0);
  });
  it("should successfully get account interest sent to recipient", async () => {
    const interestSent = await user2.interestSent(customer3.address);
    expect(interestSent).to.be.greaterThan(0);
  });
  it("should successfully get account interest sent by multiple contributors", async () => {
    const user1 = rutils.user(customer1.address);
    const interestSentBy1 = await user1.interestSent(customer3.address, true);

    const interestSentBy2 = await user2.interestSent(customer3.address, true);

    const accountStats = await rtoken.getAccountStats(customer3.address);
    const cumulativeInterest = formatUnits(accountStats.cumulativeInterest, 18);
    expect((interestSentBy1 + interestSentBy2).toFixed(16)).to.be(
      Number(cumulativeInterest).toFixed(16)
    );
  });
  it("should successfully get account interest, including unredeemed portion", async () => {
    const user1 = rutils.user(customer1.address);
    const interestSentBy1 = await user1.interestSent(customer3.address);
    const interestSentBy2 = await user2.interestSent(customer3.address);
    const accountStats = await rtoken.getAccountStats(customer3.address);
    const cumulativeInterest = formatUnits(accountStats.cumulativeInterest, 18);
    expect((interestSentBy1 + interestSentBy2).toFixed(3)).to.be(
      (0.15634568565138592).toFixed(3)
    );
  });
  // it("should successfully get all interest received", async () => {
  //   const interest = await user3.interestReceived(true);
  //   const accountStats = await rtoken.getAccountStats(customer3.address);
  //   const cumulativeInterest = formatUnits(accountStats.cumulativeInterest, 18);
  //   expect(interestSent.toFixed(18)).to.be(cumulativeInterest.toFixed(18));
  // });
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
