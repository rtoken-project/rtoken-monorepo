import User from "./user";
import Hat from "./hat";

export default class RTokenUtils {
  constructor(apolloInstance, options = {}) {
    if (!apolloInstance) {
      throw new Error("Please pass an Apollo Instance");
    }
    this.client = apolloInstance;

    this.options = {};
    this.options.deubug = options.debug;
  }

  user(options) {
    if (!options || !options.address) {
      throw new Error("Please pass an address");
    }
    // TODO: simplify by deepmerge options & this.options
    const user = new User(this.client, options, this.options);
    return user;
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
