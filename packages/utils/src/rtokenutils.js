import User from "./user";
import Hat from "./hat";
import { getErrorResponse } from "./utils/error";
import { getCleanAddress, getCleanHatId } from "./utils/general";

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

  hat(id) {
    try {
      if (!id) throw "Please provide a hat ID";
      return new Hat(
        this.client,
        this.provider,
        getCleanHatId(id),
        this.options
      );
    } catch (error) {
      throw getErrorResponse(error, "RTokenUtils", "hat");
    }
  }
}
