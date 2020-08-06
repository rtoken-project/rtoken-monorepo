import RTokenUtils, { getClient } from "../src";
var expect = require("expect.js");
import chai from "chai";
const { assert } = chai;

let apolloInstance;
let rutils;

describe("Tests library instantiation", () => {
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
  it("should successfully create a new library object with no Web3Provider or options", () => {
    rutils = new RTokenUtils(apolloInstance);
    expect(rutils).to.be.an("object");
  });
  it("should successfully create a new library object with a Web3Provider and options", () => {
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

describe("Tests user instantiation", () => {
  it("should throw an error if address is not provided", () => {
    assert.throws(
      () => rutils.user(),
      "Error @rtoken/utils RTokenUtils.user(): Please provide an address"
    );
  });
  it("should throw an error if address is malformed", () => {
    assert.throws(
      () => rutils.user("0xabc"),
      "Error @rtoken/utils RTokenUtils.user(): Ethereum address is invalid"
    );
  });
  it("should successfully create a User", () => {
    const user = rutils.user("0xdf265663574E3F0D1CE5240E223452CEdBD8FAFA");
    expect(user).to.be.an("object");
  });
});
describe("Tests user instantiation", () => {
  it("should throw an error if ID is not provided", () => {
    assert.throws(
      () => rutils.hat(),
      "Error @rtoken/utils RTokenUtils.hat(): Please provide a hat ID"
    );
  });
  it("should throw an error if ID is malformed", () => {
    assert.throws(
      () => rutils.hat("-1"),
      "Error @rtoken/utils RTokenUtils.hat(): Hat ID must be a whole number, of type Number or String"
    );
  });
  it("should successfully create a Hat", () => {
    const hat = rutils.hat(1);
    expect(hat).to.be.an("object");
  });
});
