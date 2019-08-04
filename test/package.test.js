contract("package test", () => {

    it("load contracts", async () => {
        const { IRToken, IERC20 }  = require("..").load(web3.currentProvider);
        assert.isDefined(IRToken.abi);
        assert.isDefined(IERC20.abi);
    });

});
