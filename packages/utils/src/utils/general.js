export const getCompoundRate = async (blockTimestamp) => {
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
  const COMPOUND_URL =
    'https://api.compound.finance/api/v2/market_history/graph?asset=0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643';
  const params = `&min_block_timestamp=${blockTimestamp}&max_block_timestamp=${
    blockTimestamp + 1
  }&num_buckets=1`;
  const res = await axios.get(`${COMPOUND_URL}${params}`);
  return res.data.supply_rates[0].rate;
};
