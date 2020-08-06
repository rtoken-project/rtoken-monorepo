var expect = require("expect.js");
import chai from "chai";
const { assert } = chai;

import { getRutils } from "./utils/general";

let rutils;

before(function () {
  rutils = getRutils();
});

describe("Tests basic hat lookup", () => {
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
