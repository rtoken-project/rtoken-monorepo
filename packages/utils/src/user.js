import { formatUnits } from "@ethersproject/units";

import {
  getAccountById,
  getLoanById,
  allReceivedLoans,
  allOwnedLoans,
} from "../src/graphql-operations/queries";
import { getContract } from "./utils/web3";
import { DEFAULT_NETWORK } from "./utils/constants";
import { getErrorResponse } from "./utils/error";
import { getCleanAddress } from "./utils/general";

export default class User {
  constructor(client, provider, address, options) {
    this.client = client;
    this.provider = provider;
    this.address = address;
    this.options = { ...options, network: options.network || DEFAULT_NETWORK };
  }

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
  async interestSentTo(recipient, redeemedOnly) {
    try {
      const { data, error } = await this.client.query({
        query: getLoanById,
        variables: {
          id: `${this.address}-${getCleanAddress(recipient)}`,
        },
      });
      if (error) throw error;
      if (!data.loan) return 0;
      const { amount, sInternal, interestRedeemed } = data.loan;
      let interestSent = Number(interestRedeemed);

      if (!redeemedOnly) {
        const ias = await getContract(
          "ias",
          this.options.network,
          this.provider
        );
        let exchangeRateStored = Number(
          formatUnits(await ias.exchangeRateStored(), 18)
        );
        const sInDai = Number(sInternal) * exchangeRateStored;
        interestSent = interestSent + sInDai - Number(amount);
      }
      return interestSent;
    } catch (error) {
      throw getErrorResponse(error, "user", "interestSent");
    }
  }
  async interestSentList(redeemedOnly) {
    try {
      const { data, error } = await this.client.query({
        query: allOwnedLoans,
        variables: {
          owner: this.address,
        },
      });
      if (error) throw error;
      // TODO: handle no loans
      if (!data.loans) return [];
      let loans = data.loans;
      if (!redeemedOnly) {
        const ias = await getContract(
          "ias",
          this.options.network,
          this.provider
        );
        const exchangeRateStored = Number(
          formatUnits(await ias.exchangeRateStored(), 18)
        );
        data.loans.map((loan, i) => {
          const { amount, sInternal, interestRedeemed } = loan;
          const sInDai = Number(sInternal) * exchangeRateStored;
          loans[i].interestSent =
            Number(interestRedeemed) + sInDai - Number(amount);
          loans[i].recipient = loans[i].recipient && loans[i].recipient.id;
        });
      }
      return loans;
    } catch (error) {
      throw getErrorResponse(error, "user", "interestSentList");
    }
  }
  async interestSentSum(redeemedOnly) {
    try {
      let sum = 0;
      const interestSentList = await this.interestSentList(redeemedOnly);
      interestSentList.map((loan) => {
        sum += redeemedOnly ? loan.interestRedeemed : loan.interestSent;
      });
      return sum;
    } catch (error) {
      throw getErrorResponse(error, "user", "interestSentSum");
    }
  }
  async interestReceivedList(redeemedOnly) {
    try {
      const { data, error } = await this.client.query({
        query: allReceivedLoans,
        variables: {
          recipient: this.address,
        },
      });
      if (error) throw error;
      // TODO: handle no loans
      if (!data.loans) return [];
      let loans = data.loans;
      if (!redeemedOnly) {
        const ias = await getContract(
          "ias",
          this.options.network,
          this.provider
        );
        const exchangeRateStored = Number(
          formatUnits(await ias.exchangeRateStored(), 18)
        );
        data.loans.map((loan, i) => {
          const { amount, sInternal, interestRedeemed } = loan;
          const sInDai = Number(sInternal) * exchangeRateStored;
          loans[i].interestSent =
            Number(interestRedeemed) + sInDai - Number(amount);
          loans[i].sender = loans[i].owner.id;
        });
      }
      return loans;
    } catch (error) {
      throw getErrorResponse(error, "user", "interestReceivedList");
    }
  }
  async interestReceivedSum(redeemedOnly) {
    try {
      let sum = 0;
      const interestReceivedList = await this.interestReceivedList(
        redeemedOnly
      );
      interestReceivedList.map((loan) => {
        sum += redeemedOnly ? loan.interestRedeemed : loan.interestSent;
      });
      return sum;
    } catch (error) {
      throw getErrorResponse(error, "user", "interestReceivedSum");
    }
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
