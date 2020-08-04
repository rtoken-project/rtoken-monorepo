import { throwError } from "./error";

export const getCompoundRate = async (blockTimestamp) => {
  const COMPOUND_URL =
    "https://api.compound.finance/api/v2/market_history/graph?asset=0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643";
  const params = `&min_block_timestamp=${blockTimestamp}&max_block_timestamp=${
    blockTimestamp + 1
  }&num_buckets=1`;
  const res = await axios.get(`${COMPOUND_URL}${params}`);
  return res.data.supply_rates[0].rate;
};

const validateAddress = (address) => {
  if (!isAddress(address)) throwError("input", "address");
};

const isAddress = (address) => {
  return /^(0x)?[0-9a-f]{40}$/i.test(address);
};

export const getCleanAddress = (address) => {
  validateAddress(address);
  return address.toLowerCase();
};

export const getCleanHatId = (id) => {
  try {
    let cleanId = typeof id === "string" ? Number(id) : id;
    if (cleanId < 0) throw Error;
    return cleanId.toString();
  } catch (error) {
    throwError("input", "hatId");
  }
};
