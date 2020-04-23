var expect = require('expect.js');

import { getRutils } from './utils/client';

let rutils;

before(function () {
  rutils = getRutils();
});

describe('Tests basic hat lookup', () => {
  it('should successfully query allUsers', async () => {
    const hat = rutils.hat({
      id: '1',
    });
    const accounts = await hat.allUsers();
    expect(accounts).to.be.an('array');
  });
  it('should successfully query topDonor', async () => {
    const hat = rutils.hat({
      id: '1',
    });
    const topDonor = await hat.topDonor();
    expect(topDonor).to.have.property('balance');
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
