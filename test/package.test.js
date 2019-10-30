const Web3 = require("web3");
const { assert } = require("chai");

describe("package test", () => {

    it("load contracts", async () => {
        const provider = new Web3.providers.HttpProvider("http://vitalik.mob");
        const { IRToken, IERC20 }  = require("..").load(provider);
        assert.isDefined(IRToken.abi);
        assert.isDefined(IERC20.abi);
    });

});
