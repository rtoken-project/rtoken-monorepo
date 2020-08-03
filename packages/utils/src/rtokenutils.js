import User from "./user";
import Hat from "./hat";

export default class RTokenUtils {
  constructor(apolloInstance, provider, options) {
    if (!apolloInstance) {
      throw new Error("Please pass an Apollo Instance");
    }
    this.client = apolloInstance;
    this.provider = provider;
    this.options = options;
  }

  user(address) {
    if (!address) throw new Error("Please pass an address");
    return new User(this.client, this.provider, address, this.options);
  }

  hat(options) {
    if (!options || !options.id) {
      throw new Error("Please pass a hat ID");
    }
    if (typeof options.id === "number") options.id = options.id.toString();
    const hat = new Hat(this.client, options, this.options);
    return hat;
  }
}
