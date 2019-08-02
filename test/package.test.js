contract("package test", () => {

    it("load package", async () => {
        const { IRToken }  = require("..").load(web3.currentProvider);
        assert.isDefined(IRToken.abi);
    });

});
