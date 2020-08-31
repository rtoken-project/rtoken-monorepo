import { Contract } from "@ethersproject/contracts";
import { formatUnits } from "@ethersproject/units";
import { throwError, getErrorResponse } from "./error";

const COMPOUND_API_URL = "https://api.compound.finance/api/v2/";
const DAI_INTEREST_RATE_PARAMS =
  "ctoken?addresses[]=0x5d3a536e4d6dbd6114cc1ead35777bab948e3643";
const DAI_INTEREST_RATE_HISTORIC_PARAMS =
  "market_history/graph?asset=0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643";

export const getCompoundRate = async () => {
  try {
    const res = await fetch(COMPOUND_API_URL + DAI_INTEREST_RATE_PARAMS);
    const data = await res.json();
    const rate = data.cToken[0].supply_rate.value;
    return { rate, formattedRate: Math.round(rate * 10000) / 100 };
  } catch (error) {
    throw getErrorResponse(error, "getCompoundRate");
  }
};

export const getCompoundRateAtBlock = async (blockTimestamp) => {
  try {
    const params = `&min_block_timestamp=${blockTimestamp}&max_block_timestamp=${
      blockTimestamp + 1
    }&num_buckets=1`;
    const res = await fetch(
      COMPOUND_API_URL + DAI_INTEREST_RATE_HISTORIC_PARAMS + params
    );
    const data = await res.json();
    const rate = data.supply_rates[0].rate;
    return { rate, formattedRate: Math.round(rate * 10000) / 100 };
  } catch (error) {
    throw getErrorResponse(error, "getCompoundRateAtBlock");
  }
};

export const getEthPrice = async (provider) => {
  if (provider.network !== "homestead") return 204;
  const medianizerContract = new Contract(
    "0x729D19f657BD0614b4985Cf1D82531c67569197B",
    `[{"constant":true,"inputs":[],"name":"read","outputs":[{"name":"","type":"bytes32"}],"payable":false,"type":"function"}]`,
    provider
  );
  const ethPrice = await medianizerContract.read();
  return Number(formatUnits(ethPrice, 18));
};

// Internal

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
