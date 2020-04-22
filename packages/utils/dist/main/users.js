(function (global, factory) {
  if (typeof define === "function" && define.amd) {
    define(['module'], factory);
  } else if (typeof exports !== "undefined") {
    factory(module);
  } else {
    var mod = {
      exports: {}
    };
    factory(mod);
    global.users = mod.exports;
  }
})(this, function (module) {
  'use strict';

  class Users {
    // USER STATS

    // Returns all interest accrued within time period no matter where it was sent
    getTotalInterestGenerated(address, timePeriod) {
      // TODO:
      return {};
    }

    // Returns all accrued interest retained by the wallet
    //TODO

    // Returns all interest paid to the user
    async getTotalInterestPaid(address, timePeriod) {
      const operation = {
        query: gql`
        query getUser($id: Bytes) {
          user(id: $id) {
            id
            totalInterestPaid
          }
        }
      `,
        variables: { id: address }
      };
      let res = await makePromise(execute(this.client, operation));
      return res.data.user.totalInterestPaid;
    }

    // Returns all interest sent to wallets other than the user’s
    getTotalInterestSent(address, timePeriod) {
      // TODO:
      return {};
    }

    // Returns list of addresses that an address has sent interest to
    async getAllOutgoing(address, timePeriod) {
      const operation = {
        query: gql`
        query getAccount($id: Bytes) {
          account(id: $id) {
            loansOwned {
              amount
              recipient {
                id
              }
              hat {
                id
              }
              transfers {
                value
                transaction {
                  id
                  timestamp
                  blockNumber
                }
              }
            }
          }
        }
      `,
        variables: { id: address }
      };
      let res = await makePromise(execute(this.client, operation));
      let loansOwned = [];
      if (res.data.account && res.data.account.loansOwned) loansOwned = res.data.account.loansOwned;
      return loansOwned;
    }

    // Returns list of addresses that have sent any interest to this address, and the amounts
    async getAllIncoming(address, timePeriod) {
      const operation = {
        query: gql`
        query getAccount($id: Bytes) {
          account(id: $id) {
            loansReceived {
              amount
              recipient {
                id
              }
              hat {
                id
              }
              transfers {
                value
                transaction {
                  id
                  timestamp
                  blockNumber
                }
              }
            }
          }
        }
      `,
        variables: { id: address }
      };
      let res = await makePromise(execute(this.client, operation));
      let loansReceived = [];
      if (res.data.account && res.data.account.loansReceived) loansReceived = res.data.account.loansReceived;
      return loansReceived;
    }

    // SENDING / RECEIVING

    // Returns total amount of interest received by an address from all sources
    // Excludes interest generated from user’s own wallet
    getTotalInterestReceivedExternal(address, timePeriod) {
      // TODO:
      return {};
    }

    // Returns total amount of interest received by an address from a single address
    async getInterestSent(addressFrom, addressTo, timePeriod) {
      const operation = {
        query: gql`
        query getAccount($from: Bytes, $to: Bytes) {
          account(id: $from) {
            balance
            loansOwned(where: { recipient: $to }) {
              amount
              recipient {
                id
              }
              hat {
                id
              }
              transfers {
                value
                transaction {
                  id
                  timestamp
                  blockNumber
                }
              }
            }
          }
        }
      `,
        variables: {
          from: addressFrom.toLowerCase(),
          to: addressTo.toLowerCase()
        }
      };
      let res = await makePromise(execute(this.client, operation));
      let interestSent = 0;
      let value = new BigNumber(0);
      if (res.data.account.loansOwned.length < 1) return 0;
      const loan = res.data.account.loansOwned[0];
      for (let index = 0; index < loan.transfers.length; index++) {
        const transfer = loan.transfers[index];
        let rate = null;

        // If this is the first transfer, skip it
        if (index === 0) {
          value = value.plus(transfer.value);
          if (loan.transfers.length === 1) {
            const start = transfer.transaction.timestamp;
            const date = new Date();
            const now = Math.round(date.getTime() / 1000);
            rate = await this._getCompoundRate(start);
            interestSent += this._calculateInterestOverTime(value, start, now, rate);
          }
        }
        // If this is the last transfer, add the accumulated interest until the current time
        else if (index === loan.transfers.length - 1) {
            value = value.plus(transfer.value);

            const start = transfer.transaction.timestamp;
            const date = new Date();
            const now = Math.round(date.getTime() / 1000);

            rate = await this._getCompoundRate(start);
            interestSent += this._calculateInterestOverTime(value, start, now, rate);
            // console.log('Final ransfer. Current value: ', value.toNumber());
          } else {
            // Normal case: Add the accumulated interest since last transfer
            rate = await this._getCompoundRate(loan.transfers[index - 1].transaction.timestamp);

            interestSent += this._calculateInterestOverTime(value, loan.transfers[index - 1].transaction.timestamp, transfer.transaction.timestamp, rate);

            // Add the current transfer value to the running value
            value = value.plus(transfer.value);
          }
      }
      return interestSent;
    }

    _calculateInterestOverTime(value, start, end, startingAPY) {
      const duration = end - start;
      const period = duration / 31557600; // Adjust for APY
      return value * period * startingAPY;
    }

    async _getCompoundRate(blockTimestamp) {
      // Note: This is incorrect. Calculating rate is much more complex than just getting it from storage.
      // I was trying to avoid using compoiund historic data API, since its so slow...

      // const res = await this.web3Provider.getStorageAt(
      //   '0xec163986cC9a6593D6AdDcBFf5509430D348030F',
      //   1,
      //   9220708
      // );
      // const unformatted_rate = new BigNumber(2102400 * parseInt(res, 16));
      // const rate = unformatted_rate.times(BigNumber(10).pow(-18));
      // console.log(
      //   `Compound rate (WRONG): ${Math.round(rate.toNumber() * 100000) / 1000}%`
      // );

      // Used to inspect storage on a contract
      // for (let index = 0; index < 23; index++) {
      //   const rate = await this.web3Provider.getStorageAt(
      //     '0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643',
      //     index,
      //     9220800
      //   );
      //   // console.log(`[${index}] ${rate}`);
      //   console.log(`[${index}] ${parseInt(rate, 16)}`);
      // }

      // Correct, new way to get the rate
      const COMPOUND_URL = 'https://api.compound.finance/api/v2/market_history/graph?asset=0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643';
      const params = `&min_block_timestamp=${blockTimestamp}&max_block_timestamp=${blockTimestamp + 1}&num_buckets=1`;
      const res = await axios.get(`${COMPOUND_URL}${params}`);
      return res.data.supply_rates[0].rate;
    }
  }

  module.exports = Users;
});