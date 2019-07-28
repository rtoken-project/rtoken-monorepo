contract("package test", () => {

    it("load package", async () => {
        const { RToken }  = require("..").load(web3.currentProvider);
        assert.isDefined(RToken.abi);
    });

});
