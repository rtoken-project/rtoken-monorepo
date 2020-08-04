import User from "./user";
import Hat from "./hat";
import { getErrorResponse } from "./utils/error";
import { getCleanAddress } from "./utils/general";

export default class RTokenUtils {
  constructor(apolloInstance, provider, options) {
    if (!apolloInstance)
      throw getErrorResponse(
        "Please pass an Apollo Instance",
        "RTokenUtils",
        "user"
      );
    this.client = apolloInstance;
    this.provider = provider;
    this.options = options;
  }

  user(address) {
    try {
      if (!address) throw "Please provide an address";
      return new User(
        this.client,
        this.provider,
        getCleanAddress(address),
        this.options
      );
    } catch (error) {
      throw getErrorResponse(error, "RTokenUtils", "user");
    }
  }

  hat(options) {
    try {
      if (!options || !options.id) throw "Please provide a hat ID";
      if (typeof options.id === "number") options.id = options.id.toString();
      return new Hat(this.client, options, this.options);
    } catch (error) {
      throw getErrorResponse(error, "RTokenUtils", "hat");
    }
  }
}
