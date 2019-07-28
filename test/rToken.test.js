//const { expectRevert } = require("openzeppelin-test-helpers");
const ERC20Mintable = artifacts.require("ERC20Mintable");
const ComptrollerMock = artifacts.require("ComptrollerMock");
const InterestRateModelMock = artifacts.require("InterestRateModelMock");
const CErc20 = artifacts.require("CErc20");
const { web3tx } = require("@decentral.ee/web3-test-helpers");
const { toDecimals, fromDecimals } = require("../lib/math-utils");

function wad4human(wad) {
    return fromDecimals(wad, 18);
}

contract("rDAI contract", accounts => {
    //const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

    const admin = accounts[0];
    const customer1 = accounts[1];
    let testToken;
    let cTestToken;

    before(async () => {
        console.log("admin is", admin);
        console.log("customer1 is", customer1);
        CErc20.setProvider(web3.currentProvider);
    });

    beforeEach(async () => {
        testToken = await web3tx(ERC20Mintable.new, "ERC20Mintable.new")({ from: admin });
        await web3tx(testToken.mint, "testToken mint 1000 -> customer1")(customer1, toDecimals(1000, 18), { from: admin });
        const comptroller = await web3tx(ComptrollerMock.new, "ComptrollerMock.new")({ from: admin });
        const interestRateModel = await web3tx(InterestRateModelMock.new, "InterestRateModelMock.new")({ from: admin });
        cTestToken = await web3tx(CErc20.new, "CErc20.new")(
            testToken.address,
            comptroller.address,
            interestRateModel.address,
            toDecimals(.1, 18), // exchange rate 1 cDAI == 10 DAI
            "Compound TestToken",
            "cTestToken",
            18, {
                from: admin
            });
    });

    it("supply token and get rToken", async () => {
        const supplyAmount = toDecimals(10, 18);
        assert.equal(wad4human(await cTestToken.balanceOf.call(customer1)), "0");
        await web3tx(testToken.approve, "testeToken.approve 10 by customer1")(cTestToken.address, supplyAmount, {
            from: customer1
        });
        await web3tx(cTestToken.mint, "cTestToken mint 10", {
            inLogs: [{
                name: "Mint"
            }]
        })(supplyAmount, {
            from: customer1
        });
        assert.equal(wad4human(await cTestToken.balanceOf.call(customer1)), "100");
    });

});
