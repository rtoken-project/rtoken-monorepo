const ERC20Mintable = artifacts.require("ERC20Mintable");
const CErc20 = artifacts.require("CErc20");
const InterestRateModelMock = artifacts.require("InterestRateModelMock");
const ComptrollerMock = artifacts.require("ComptrollerMock");
const { time } = require("openzeppelin-test-helpers");
const { web3tx, wad4human, toWad } = require("@decentral.ee/web3-test-helpers");

// testing the baseline behavior of CToken contract
contract("CToken", accounts => {

    const admin = accounts[0];
    const bingeBorrower = accounts[1];
    const customer1 = accounts[2];
    let token;
    let cToken;

    before(async () => {
        console.log("admin is", admin);
        console.log("bingeBorrower is", bingeBorrower);
        console.log("customer1 is", customer1);
    });

    async function doBingeBorrowing(nBlocks = 100) {
        // this process should generate 0.0001% * nBlocks amount of tokens worth of interest
        // when nBlocks = 100, it is 0.001

        console.log(`Before binge borrowing: 1 cToken = ${wad4human(await cToken.exchangeRateStored.call())} Token`);
        // for testing purpose, our mock doesn't even check if there is
        // sufficient collateral in the system!!
        const borrowAmount = toWad(10);
        await web3tx(cToken.borrow, "cToken.borrow 10 to bingeBorrower", {
            inLogs: [{
                name: "Borrow"
            }]
        })(borrowAmount, {
            from: bingeBorrower
        });
        await waitForInterest(nBlocks);
        console.log(`After binge borrowing: 1 cToken = ${wad4human(await cToken.exchangeRateStored.call())} Token`);
    }

    async function waitForInterest(nBlocks = 100) {
        console.log(`Wait for ${nBlocks} blocks...`);
        while(--nBlocks) await time.advanceBlock();
        await web3tx(cToken.accrueInterest, "cToken.accrueInterest")({ from: admin });
    }

    beforeEach(async () => {
        token = await web3tx(ERC20Mintable.new, "ERC20Mintable.new")({ from: admin });
        await web3tx(token.mint, "token.mint 1000 -> customer1")(customer1, toWad(1000), { from: admin });
        const comptroller = await web3tx(ComptrollerMock.new, "ComptrollerMock.new")({ from: admin });
        const interestRateModel = await web3tx(InterestRateModelMock.new, "InterestRateModelMock.new")({ from: admin });
        cToken = await web3tx(CErc20.new, "CErc20.new")(
            token.address,
            comptroller.address,
            interestRateModel.address,
            toWad(.1), // exchange rate 1 cDAI == .1 cDAI
            "Compound token",
            "cToken",
            18, {
                from: admin
            });
    });

    it("#1 cToken basic operations", async () => {
        await web3tx(token.approve, "token.approve 100 by customer1")(cToken.address, toWad(100), {
            from: customer1
        });
        await web3tx(cToken.mint, "cToken.mint 100 to customer1", {
            inLogs: [{
                name: "Mint"
            }]
        })(toWad(100), {
            from: customer1
        });
        assert.equal(wad4human(await cToken.balanceOf.call(customer1)), "1000.00000");
        assert.equal(wad4human(await token.balanceOf.call(customer1)), "900.00000");

        // no intrest yet
        await web3tx(cToken.redeem, "cToken.redeem 100", {
            inLogs: [{
                name: "Redeem"
            }]
        })(toWad(100), {
            from: customer1
        });
        assert.equal(wad4human(await cToken.balanceOf.call(customer1)), "900.00000");
        assert.equal(wad4human(await token.balanceOf.call(customer1)), "910.00000");

        await doBingeBorrowing();

        // interests accumulated
        await web3tx(cToken.redeem, "cToken.redeem 100", {
            inLogs: [{
                name: "Redeem"
            }]
        })(toWad(100), {
            from: customer1
        });
        assert.equal(wad4human(await cToken.balanceOf.call(customer1)), "800.00000");
        const tokenAmount1 = await token.balanceOf.call(customer1);
        console.log("token redeemed", wad4human(tokenAmount1));
        assert.isTrue(tokenAmount1.gt(toWad(920)));

        // redeem underlying
        await web3tx(cToken.redeemUnderlying, "cToken.redeemUnderlying 10", {
            inLogs: [{
                name: "Redeem"
            }]
        })(toWad(10), {
            from: customer1
        });
        assert.isTrue((await cToken.balanceOf.call(customer1)).gt(toWad(700)));
        assert.isTrue((await token.balanceOf.call(customer1)).eq(tokenAmount1.add(toWad(10))));
    });
});
