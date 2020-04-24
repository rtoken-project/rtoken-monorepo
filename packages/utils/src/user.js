import { getAccountById } from '../src/graphql-operations/queries';

export default class User {
  constructor(client, options, globalOptions) {
    this.client = client;

    this.options = options;
    this.address = options.address;

    this.globalOptions = globalOptions;
  }

  // Returns all interest paid to the user
  async details() {
    const res = await this.client.query({
      query: getAccountById,
      variables: {
        id: this.address,
      },
    });
    if (!res.data.account) {
      // TODO handle error no account found
    }
    return res.data.account;
  }

  ////////////////////////////////////////////
  // TODO (or old version)
  ////////////////////////////////////////////

  //
  // async totalInterestGenerated() {
  //   const res = await this.client.query({
  //     query: getAccountById,
  //     variables: {
  //       id: this.address,
  //     },
  //   });
  //   if (!res.data.account) {
  //     // TODO handle error no account found
  //   }
  //   return res.data.account.totalInterestPaid;
  // }
  //
  // // Returns all interest sent to wallets other than the user’s
  // getTotalInterestSent(address, timePeriod) {
  //   // TODO:
  //   return {};
  // }
  //
  // // Returns list of addresses that an address has sent interest to
  // async getOutgoingHistory(address, timePeriod) {
  //   const operation = {
  //     query: gql`
  //       query getAccount($id: Bytes) {
  //         account(id: $id) {
  //           loansOwned {
  //             amount
  //             recipient {
  //               id
  //             }
  //             hat {
  //               id
  //             }
  //             transfers {
  //               value
  //               transaction {
  //                 id
  //                 timestamp
  //                 blockNumber
  //               }
  //             }
  //           }
  //         }
  //       }
  //     `,
  //     variables: { id: address },
  //   };
  //   let res = await makePromise(execute(this.client, operation));
  //   let loansOwned = [];
  //   if (res.data.account && res.data.account.loansOwned)
  //     loansOwned = res.data.account.loansOwned;
  //   return loansOwned;
  // }
  //
  // // Returns list of addresses that have sent any interest to this address, and the amounts
  // async getAllIncoming(address, timePeriod) {
  //   const operation = {
  //     query: gql`
  //       query getAccount($id: Bytes) {
  //         account(id: $id) {
  //           loansReceived {
  //             amount
  //             recipient {
  //               id
  //             }
  //             hat {
  //               id
  //             }
  //             transfers {
  //               value
  //               transaction {
  //                 id
  //                 timestamp
  //                 blockNumber
  //               }
  //             }
  //           }
  //         }
  //       }
  //     `,
  //     variables: { id: address },
  //   };
  //   let res = await makePromise(execute(this.client, operation));
  //   let loansReceived = [];
  //   if (res.data.account && res.data.account.loansReceived)
  //     loansReceived = res.data.account.loansReceived;
  //   return loansReceived;
  // }
  //
  // // SENDING / RECEIVING
  //
  // // Returns total amount of interest received by an address from all sources
  // // Excludes interest generated from user’s own wallet
  // getTotalInterestReceivedExternal(address, timePeriod) {
  //   // TODO:
  //   return {};
  // }
  //
  // // Returns total amount of interest received by an address from a single address
  // async getInterestSent(addressFrom, addressTo, timePeriod) {
  //   const operation = {
  //     query: gql`
  //       query getAccount($from: Bytes, $to: Bytes) {
  //         account(id: $from) {
  //           balance
  //           loansOwned(where: { recipient: $to }) {
  //             amount
  //             recipient {
  //               id
  //             }
  //             hat {
  //               id
  //             }
  //             transfers {
  //               value
  //               transaction {
  //                 id
  //                 timestamp
  //                 blockNumber
  //               }
  //             }
  //           }
  //         }
  //       }
  //     `,
  //     variables: {
  //       from: addressFrom.toLowerCase(),
  //       to: addressTo.toLowerCase(),
  //     },
  //   };
  //   let res = await makePromise(execute(this.client, operation));
  //   let interestSent = 0;
  //   let value = new BigNumber(0);
  //   if (res.data.account.loansOwned.length < 1) return 0;
  //   const loan = res.data.account.loansOwned[0];
  //   for (let index = 0; index < loan.transfers.length; index++) {
  //     const transfer = loan.transfers[index];
  //     let rate = null;
  //
  //     // If this is the first transfer, skip it
  //     if (index === 0) {
  //       value = value.plus(transfer.value);
  //       if (loan.transfers.length === 1) {
  //         const start = transfer.transaction.timestamp;
  //         const date = new Date();
  //         const now = Math.round(date.getTime() / 1000);
  //         rate = await this._getCompoundRate(start);
  //         interestSent += this._calculateInterestOverTime(
  //           value,
  //           start,
  //           now,
  //           rate
  //         );
  //       }
  //     }
  //     // If this is the last transfer, add the accumulated interest until the current time
  //     else if (index === loan.transfers.length - 1) {
  //       value = value.plus(transfer.value);
  //
  //       const start = transfer.transaction.timestamp;
  //       const date = new Date();
  //       const now = Math.round(date.getTime() / 1000);
  //
  //       rate = await this._getCompoundRate(start);
  //       interestSent += this._calculateInterestOverTime(
  //         value,
  //         start,
  //         now,
  //         rate
  //       );
  //       // console.log('Final ransfer. Current value: ', value.toNumber());
  //     } else {
  //       // Normal case: Add the accumulated interest since last transfer
  //       rate = await this._getCompoundRate(
  //         loan.transfers[index - 1].transaction.timestamp
  //       );
  //
  //       interestSent += this._calculateInterestOverTime(
  //         value,
  //         loan.transfers[index - 1].transaction.timestamp,
  //         transfer.transaction.timestamp,
  //         rate
  //       );
  //
  //       // Add the current transfer value to the running value
  //       value = value.plus(transfer.value);
  //     }
  //   }
  //   return interestSent;
  // }
  //
  // _calculateInterestOverTime(value, start, end, startingAPY) {
  //   const duration = end - start;
  //   const period = duration / 31557600; // Adjust for APY
  //   return value * period * startingAPY;
  // }

  // // Returns array of objects for each instance that a address’ rToken balance changes. Object returns:
  // getTokenBalanceHistoryByAddress(address, timePeriod) {
  //   // TODO
  //   return {
  //     // Amount of balance change
  //     // Transaction Hash
  //   };
  // }
  //
  // // Returns all interest accrued within time period no matter where it was sent
  // getTotalInterestGenerated(address, timePeriod) {
  //   return {};
  // }

  //////////////////////////////////
  // Deprecated due to dependency on web3 connection
  /////////////////////////////////

  // async receivedSavingsOf(address) {
  //   const rdai = await getContract('rdai');
  //   const savings = await rdai.receivedSavingsOf(address);
  //   return savings;
  // }
}
