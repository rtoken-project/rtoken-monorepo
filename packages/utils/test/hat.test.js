var expect = require("expect.js");
import chai from "chai";
const { assert } = chai;

import { getRutils } from "./utils/general";

let rutils;

before(function () {
  rutils = getRutils();
});

describe("Tests basic hat lookup", () => {
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
  it("should successfully query allUsers", async () => {
    const hat = rutils.hat({
      id: "1",
    });
    const accounts = await hat.allUsers();
    expect(accounts).to.be.an("array");
  });
  it("should successfully query topDonor", async () => {
    const hat = rutils.hat({
      id: "1",
    });
    const topDonor = await hat.topDonor();
    expect(topDonor).to.have.property("balance");
  });
});
