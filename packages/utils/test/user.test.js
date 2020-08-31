// var test = require('mocha').describe;
// var assert = require('chai').assert;
import { BigNumber } from "@ethersproject/bignumber";
import { parseUnits, formatUnits } from "@ethersproject/units";
var expect = require("expect.js");
import chai from "chai";
const { assert } = chai;

import { getContract } from "../src/utils/web3";

import { getRutils, getWeb3Provider } from "./utils/general";
import { getUsers } from "./utils/users";

const rutils = getRutils();
const { customer1, customer2, customer3 } = getUsers();
let rtoken;
const user1 = rutils.user(customer1.address);
const user2 = rutils.user(customer2.address);
const user3 = rutils.user(customer3.address);

before(async () => {
  rtoken = await getContract("rdai", "local", getWeb3Provider());
});

describe("Tests user basic functions", () => {
  it("should successfully get account by address", async () => {
    const details = await user2.details();
    expect(details.id).to.be(customer2.address);
  });
  it("should successfully get account rToken balance", async () => {
    const balance = formatUnits(await rtoken.balanceOf(customer2.address), 18);
    const details = await user2.details();
    expect(details.balance).to.be(Math.round(balance).toString());
  });
});
describe("Tests user interest sent", () => {
  it("should successfully return 0 if no interest has been sent", async () => {
    const interestSentTo = await user2.interestSentTo(customer1.address);
    expect(interestSentTo).to.be(0);
  });
  it("should successfully get account interest sent to recipient", async () => {
    const interestSentTo = await user2.interestSentTo(customer3.address);
    expect(interestSentTo).to.be.greaterThan(0);
  });
  it("should successfully get account interest sent by multiple contributors", async () => {
    const user1 = rutils.user(customer1.address);
    const interestSentToBy1 = await user1.interestSentTo(
      customer3.address,
      true
    );
    const interestSentToBy2 = await user2.interestSentTo(
      customer3.address,
      true
    );
    const accountStats = await rtoken.getAccountStats(customer3.address);
    const cumulativeInterest = formatUnits(accountStats.cumulativeInterest, 18);
    expect(interestSentToBy1 + interestSentToBy2).to.be(
      Number(cumulativeInterest)
    );
  });
  it("should successfully get account interest, including unredeemed portion", async () => {
    const user1 = rutils.user(customer1.address);
    const interestSentToBy1 = await user1.interestSentTo(customer3.address);
    const interestSentToBy2 = await user2.interestSentTo(customer3.address);
    const accountStats = await rtoken.getAccountStats(customer3.address);
    const cumulativeInterest = formatUnits(accountStats.cumulativeInterest, 18);
    expect((interestSentToBy1 + interestSentToBy2).toFixed(3)).to.be(
      (0.15634568565138592).toFixed(3)
    );
  });
});
describe("Tests user interest received", () => {
  it("should successfully get all interest received", async () => {
    const interestSent = await user1.interestSentTo(user3.address, true);
    const interestReceived = await user3.interestReceivedFrom(user1.address, true);
    expect(interestSent).to.be(interestReceived);
  });
  it("should successfully get all interest received, including unredeemed portion", async () => {
    const interestSent = await user1.interestSentTo(user3.address);
    const interestReceived = await user3.interestReceivedFrom(user1.address);
    expect(interestSent).to.be(interestReceived);
  });
});
describe("Tests user interest lists", () => {
  it("should successfully get list of all interest sent", async () => {
    const interestList = await user2.interestSentList(true);
    expect(interestList[0]).to.have.property("interestRedeemed");
  });
  it("should successfully get list of interest sent, including unredeemed portion", async () => {
    const interestList = await user2.interestSentList();
    expect(interestList[0]).to.have.property("interestSent");
  });
  it("should successfully get list of interest received", async () => {
    const interestList = await user2.interestSentList(true);
    expect(interestList[0]).to.have.property("interestRedeemed");
  });
  it("should successfully get list of interest received  including unredeemed portion", async () => {
    const interestList = await user2.interestSentList();
    expect(interestList[0]).to.have.property("interestSent");
  });
});
describe("Tests user interest sums", () => {
  it("should successfully get all interest received", async () => {
    const interest = await user3.interestReceivedSum(true);
    const accountStats = await rtoken.getAccountStats(customer3.address);
    const cumulativeInterest = formatUnits(accountStats.cumulativeInterest, 18);
    expect(interest).to.be(Number(cumulativeInterest));
  });
  it("should successfully get all interest received, including unredeemed portion", async () => {
    const interest = await user3.interestReceivedSum();
    expect(interest.toFixed(3)).to.be((0.15634568565138592).toFixed(3));
  });
  it("should successfully get all interest sent", async () => {
    const interest = await user1.interestSentSum(true);
    expect(interest).to.be(0.015287765243909714);
  });
  it("should successfully get all interest sent, including unredeemed portion", async () => {
    const interestSent = await user1.interestSentSum();
    const interestReceived = await user1.interestSentTo(user3.address);
    expect(interestSent).to.be(interestReceived);
  });
});
