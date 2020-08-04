import RTokenUtils, { getClient } from "../src";
var expect = require("expect.js");
import chai from "chai";
const { assert } = chai;
let apolloInstance;
let rutils;

describe("Tests library initialization", () => {
  it("should successfully create a new apollo-client instance", () => {
    apolloInstance = getClient();
    expect(apolloInstance).to.be.an("object");
  });
  it("should successfully create a new apollo-client instance with options", () => {
    apolloInstance = getClient({
      uri: "http://localhost:8000/subgraphs/name/rtoken-test",
      debug: true,
    });
    expect(apolloInstance).to.be.an("object");
  });
  it("should successfully create a new library object", () => {
    rutils = new RTokenUtils(apolloInstance);
    expect(rutils).to.be.an("object");
  });
  it("should successfully create a new library object with options", () => {
    const options = {
      debug: true,
    };
    rutils = new RTokenUtils(apolloInstance, null, options);
    expect(rutils).to.be.an("object");
  });
  it("should throw an error if client is null", () => {
    assert.throws(
      () => new RTokenUtils(null, null),
      "Error @rtoken/utils RTokenUtils.user(): Please pass an Apollo Instance"
    );
  });
});
