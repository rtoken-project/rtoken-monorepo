const { time } = require("openzeppelin-test-helpers");
const ERC20Mintable = artifacts.require("ERC20Mintable");
const ComptrollerMock = artifacts.require("ComptrollerMock");
const InterestRateModelMock = artifacts.require("InterestRateModelMock");
const CErc20 = artifacts.require("CErc20");
const RToken = artifacts.require("RToken");
const { web3tx } = require("@decentral.ee/web3-test-helpers");
const { toDecimals, fromDecimals } = require("../lib/math-utils");

function wad4human(wad) {
    return fromDecimals(wad, 18);
}

function toWad(n) {
    return web3.utils.toBN(toDecimals(n, 18));
}

contract("rDAI contract", accounts => {
    //const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

    const admin = accounts[0];
    const customer1 = accounts[1];
    const customer2 = accounts[2];
    let token;
    let cToken;
    let rToken;

    before(async () => {
        console.log("admin is", admin);
        console.log("customer1 is", customer1);
        console.log("customer2 (binge borrower) is", customer2);
    });

    beforeEach(async () => {
        token = await web3tx(ERC20Mintable.new, "ERC20Mintable.new")({ from: admin });
        await web3tx(token.mint, "token.mint 1000 -> customer1")(customer1, toDecimals(1000, 18), { from: admin });
        const comptroller = await web3tx(ComptrollerMock.new, "ComptrollerMock.new")({ from: admin });
        const interestRateModel = await web3tx(InterestRateModelMock.new, "InterestRateModelMock.new")({ from: admin });
        cToken = await web3tx(CErc20.new, "CErc20.new")(
            token.address,
            comptroller.address,
            interestRateModel.address,
            toDecimals(.1, 18), // exchange rate 1 cDAI == .1 cDAI
            "Compound token",
            "cToken",
            18, {
                from: admin
            });
        rToken = await web3tx(RToken.new, "RToken.new")(
            cToken.address, {
                from: admin
            });
    });

    async function doBingeBorrowing(nBlocks = 100) {
        // for testing purpose, our mock doesn't even check if there is
        // sufficient collateral in the system!!
        const borrowAmount = toDecimals(10, 18);
        await web3tx(cToken.borrow, "cToken.borrow 10 to customer2", {
            inLogs: [{
                name: "Borrow"
            }]
        })(borrowAmount, {
            from: customer2
        });
        while(--nBlocks) await time.advanceBlock();
    }

    it("cToken mint/redeem/borrow/redeem again", async () => {
        const supplyAmount = toDecimals(100, 18);
        assert.equal(wad4human(await cToken.balanceOf.call(customer1)), "0");

        await web3tx(token.approve, "token.approve 100 by customer1")(cToken.address, supplyAmount, {
            from: customer1
        });
        await web3tx(cToken.mint, "cToken.mint 100 to customer1", {
            inLogs: [{
                name: "Mint"
            }]
        })(supplyAmount, {
            from: customer1
        });
        assert.equal(wad4human(await cToken.balanceOf.call(customer1)), "1000");
        assert.equal(wad4human(await token.balanceOf.call(customer1)), "900");

        // no intrest yet
        await web3tx(cToken.redeem, "cToken.redeem 100", {
            inLogs: [{
                name: "Redeem"
            }]
        })(toDecimals(100, 18), {
            from: customer1
        });
        assert.equal(wad4human(await cToken.balanceOf.call(customer1)), "900");
        assert.equal(wad4human(await token.balanceOf.call(customer1)), "910");

        await doBingeBorrowing();

        // interests accumulated
        await web3tx(cToken.redeem, "cToken.redeem 100", {
            inLogs: [{
                name: "Redeem"
            }]
        })(toDecimals(100, 18), {
            from: customer1
        });
        assert.equal(wad4human(await cToken.balanceOf.call(customer1)), "800");
        const tokenAmount1 = await token.balanceOf.call(customer1);
        assert.isTrue(tokenAmount1.gt(toWad("920")));

        // redeem underlying
        await web3tx(cToken.redeemUnderlying, "cToken.redeemUnderlying 10", {
            inLogs: [{
                name: "Redeem"
            }]
        })(toDecimals(10, 18), {
            from: customer1
        });
        assert.isTrue((await cToken.balanceOf.call(customer1)).gt(toWad("700")));
        assert.isTrue((await token.balanceOf.call(customer1)).eq(tokenAmount1.add(toWad("10"))));
    });

    it("rToken mint/redeem", async () => {
        const supplyAmount = toDecimals(10, 18);
        assert.equal(wad4human(await rToken.totalSupply.call()), "0");
        await web3tx(token.approve, "token.approve 10 by customer1")(rToken.address, supplyAmount, {
            from: customer1
        });
        await web3tx(rToken.mint, "rToken.mint 10 to customer1", {
            inLogs: [{
                name: "Mint"
            }]
        })(supplyAmount, {
            from: customer1
        });
        assert.equal(wad4human(await rToken.totalSupply.call()), "10");
        assert.equal(wad4human(await rToken.balanceOf.call(customer1)), "10");
        assert.equal(wad4human(await rToken.interestBalanceOf.call(customer1)), "0");
    });
});
