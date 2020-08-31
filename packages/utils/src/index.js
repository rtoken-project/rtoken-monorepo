import RTokenUtils from "./rtokenutils";

import { getClient } from "./utils/client";
import {
  getCompoundRate,
  getCompoundRateAtBlock,
  getEthPrice,
} from "./utils/general";

export default RTokenUtils;

export { getClient, getCompoundRate, getCompoundRateAtBlock, getEthPrice };
