const { time } = require("openzeppelin-test-helpers");
const ERC20Mintable = artifacts.require("ERC20Mintable");
const ComptrollerMock = artifacts.require("ComptrollerMock");
const InterestRateModelMock = artifacts.require("InterestRateModelMock");
const CErc20 = artifacts.require("CErc20");
const RToken = artifacts.require("RToken");
const { web3tx } = require("@decentral.ee/web3-test-helpers");
const { toDecimals, fromDecimals } = require("../lib/math-utils");

function toBN(n) {
    return web3.utils.toBN(n.toString());
}

function wad4human(wad) {
    return fromDecimals(wad.toString(), 18);
}

function toWad(n) {
    return web3.utils.toBN(toDecimals(n, 18));
}

contract("rDAI contract", accounts => {
    //const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

    const admin = accounts[0];
    const customer1 = accounts[1];
    const customer2 = accounts[2];
    const customer3 = accounts[3];
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
        rToken = await web3tx(RToken.new, "RToken.new")(
            cToken.address, {
                from: admin
            });
    });

    function parseHat(hat) {
        return {
            hatID: hat.hatID.toNumber(),
            recipients: hat.recipients,
            proportions: hat.proportions.map(i=>i.toNumber())
        };
    }

    async function doBingeBorrowing(nBlocks = 100) {
        console.log(`Before binge borrowing: 1 cToken = ${wad4human(await cToken.exchangeRateStored.call())} Token`);
        // for testing purpose, our mock doesn't even check if there is
        // sufficient collateral in the system!!
        const borrowAmount = toWad(10);
        await web3tx(cToken.borrow, "cToken.borrow 10 to customer2", {
            inLogs: [{
                name: "Borrow"
            }]
        })(borrowAmount, {
            from: customer2
        });
        while(--nBlocks) await time.advanceBlock();
        await web3tx(cToken.accrueInterest, "cToken.accrueInterest")({ from: admin });
        console.log(`After binge borrowing: 1 cToken = ${wad4human(await cToken.exchangeRateStored.call())} Token`);
    }

    it("cToken mint/redeem/borrow/redeem again", async () => {
        const supplyAmount = toWad(100);
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
        })(toWad(100), {
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
        })(toWad(100), {
            from: customer1
        });
        assert.equal(wad4human(await cToken.balanceOf.call(customer1)), "800");
        const tokenAmount1 = await token.balanceOf.call(customer1);
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

    it("rToken mint/redeem without hat", async () => {
        const supplyAmount = toWad(100);
        assert.equal(wad4human(await rToken.totalSupply.call()), "0");
        await web3tx(token.approve, "token.approve 100 by customer1")(rToken.address, supplyAmount, {
            from: customer1
        });
        await web3tx(rToken.mint, "rToken.mint 100 to customer1", {
            inLogs: [{
                name: "Mint"
            }]
        })(supplyAmount, {
            from: customer1
        });
        assert.equal(wad4human(await token.balanceOf.call(customer1)), "900");
        assert.equal(wad4human(await rToken.totalSupply.call()), "100");
        assert.equal(wad4human(await rToken.balanceOf.call(customer1)), "100");
        assert.equal(wad4human(await rToken.receivedBalanceOf.call(customer1)), "100");
        assert.equal(wad4human(await rToken.interestPayableOf.call(customer1)), "0");

        await doBingeBorrowing();

        const customer1Interest = await rToken.interestPayableOf.call(customer1);
        console.log("Customer 1 interest accumuldated", wad4human(customer1Interest));
        assert.isTrue(customer1Interest.gt(toWad(0)));

        await web3tx(rToken.redeem, "rToken.redeem 10 to customer1", {
            inLogs: [{
                name: "Redeem"
            }]
        })(toWad(10), {
            from: customer1
        });
        assert.equal(wad4human(await rToken.totalSupply.call()), "90");
        assert.equal(wad4human(await rToken.balanceOf.call(customer1)), "90");
        assert.equal(wad4human(await token.balanceOf.call(customer1)), "910");
        const tinyCustomer1Interest = (await rToken.interestPayableOf.call(customer1)).sub(customer1Interest);
        const customer1ReceivedBalance = await rToken.receivedBalanceOf.call(customer1);
        console.log("Tiny customer1 interest accumuldated since the redeem", wad4human(tinyCustomer1Interest));
        console.log("Received balance of customer 1", wad4human(customer1ReceivedBalance));
        assert.isTrue(customer1ReceivedBalance
            .sub(toWad(90))
            .sub(customer1Interest)
            .sub(tinyCustomer1Interest).eq(toWad(0)));
    });

    it("rToken mint/redeem/transfer/payInterest with hat", async () => {
        const supplyAmount = toWad(100);
        assert.equal(wad4human(await rToken.totalSupply.call()), "0");
        await web3tx(token.approve, "token.approve 100 by customer1")(rToken.address, supplyAmount, {
            from: customer1
        });
        await web3tx(rToken.mintWithNewHat, "rToken.mint 100 to customer1 with a hat benefiting admin(90%) and customer2(10%)", {
            inLogs: [{
                name: "Mint"
            }]
        })(supplyAmount, [admin, customer2], [90, 10], {
            from: customer1
        });
        assert.equal(wad4human(await rToken.totalSupply.call()), "100");
        assert.equal(wad4human(await rToken.balanceOf.call(customer1)), "100");
        assert.equal(wad4human(await rToken.interestPayableOf.call(customer1)), "0");
        assert.equal(wad4human(await rToken.interestPayableOf.call(admin)), "0");
        assert.equal(wad4human(await rToken.interestPayableOf.call(customer2)), "0");
        assert.equal(wad4human(await rToken.receivedBalanceOf.call(customer1)), "0");
        const adminReceivedBalance1 = await rToken.receivedBalanceOf.call(admin);
        const customer2ReceivedBalance1 = await rToken.receivedBalanceOf.call(customer2);
        console.log("admin received balance", wad4human(adminReceivedBalance1));
        console.log("customer 1 received balance", wad4human(customer2ReceivedBalance1));
        assert.equal(wad4human(adminReceivedBalance1).slice(0, 5), "89.99");
        assert.equal(wad4human(customer2ReceivedBalance1).slice(0, 5), "10.00");

        await doBingeBorrowing();

        assert.equal(wad4human(await rToken.interestPayableOf.call(customer1)), "0");
        const adminInterest = toBN(await rToken.interestPayableOf.call(admin));
        const customer2Interest = toBN(await rToken.interestPayableOf.call(customer2));
        console.log("admin interest accumulated", wad4human(adminInterest));
        console.log("customer2 interest accumulated", wad4human(customer2Interest));
        assert.isTrue(adminInterest.gt(toWad(0)));
        assert.isTrue(customer2Interest.gt(toWad(0)));
        assert.equal(adminInterest
            .mul(toBN(1000))
            .div(customer2Interest)
            .toString().slice(0, 5), "8999");

        await web3tx(rToken.redeem, "rToken.redeem 10 to customer1", {
            inLogs: [{
                name: "Redeem"
            }]
        })(toWad(10), {
            from: customer1
        });
        assert.equal(wad4human(await rToken.totalSupply.call()), "90");
        assert.equal(wad4human(await rToken.balanceOf.call(customer1)), "90");
        assert.equal(wad4human(await token.balanceOf.call(customer1)), "910");
        assert.equal(wad4human(await rToken.interestPayableOf.call(customer1)), "0");
        const tinyAdminInterest = toBN(await rToken.interestPayableOf.call(admin)).sub(adminInterest);
        const tinyCustomer2Interest = toBN(await rToken.interestPayableOf.call(customer2)).sub(customer2Interest);
        console.log("Tiny admin interest accumuldated since the redeem", wad4human(tinyAdminInterest));
        console.log("Tiny customer2 interest accumuldated since the redeem", wad4human(tinyCustomer2Interest));
        assert.isTrue(tinyAdminInterest.lt(toWad("0.0001")));
        assert.isTrue(tinyCustomer2Interest.lt(toWad("0.0001")));
        assert.equal(wad4human(await rToken.receivedBalanceOf.call(customer1)), "0");
        const adminReceivedBalance2 = await rToken.receivedBalanceOf.call(admin);
        const customer2ReceivedBalance2 = await rToken.receivedBalanceOf.call(customer2);
        console.log("Received balance of admin", wad4human(adminReceivedBalance2));
        console.log("Received balance of customer 2", wad4human(customer2ReceivedBalance2));
        assert.equal(wad4human(adminReceivedBalance1
            .sub(adminReceivedBalance2)
            .add(adminInterest)
            .sub(toWad(9))
            .add(tinyAdminInterest)
            .abs()).slice(0, 10), "0.00000000");
        assert.equal(wad4human(customer2ReceivedBalance1
            .sub(customer2ReceivedBalance2)
            .add(customer2Interest)
            .sub(toWad(1))
            .add(tinyCustomer2Interest)
            .abs()).slice(0, 10), "0.00000000");

        await web3tx(rToken.transfer, "rToken.transfer 10 customer1 -> customer3", {
            inLogs: [{
                name: "Transfer"
            }]
        })(customer3, toWad(10), {
            from: customer1
        });
        assert.equal(wad4human(await rToken.totalSupply.call()), "90");
        assert.equal(wad4human(await rToken.balanceOf.call(customer1)), "80");
        assert.equal(wad4human(await rToken.balanceOf.call(customer3)), "10");
        assert.deepEqual(parseHat(await rToken.getHatByAddress.call(customer3)), {
            hatID: 1,
            recipients: [admin, customer2],
            proportions: [3865470565, 429496729]
        });

        assert.equal(wad4human(await rToken.balanceOf(admin)), "0");
        web3tx(rToken.payInterest, "rToken.payInterest to admin", {
            inLogs: [{
                name: "InterestPaid"
            }]
        })(admin, { from : admin });
        const adminInterestPaid = await rToken.balanceOf(admin);
        console.log("admin interested paid", wad4human(adminInterestPaid),
            "expected", wad4human(adminInterest.add(tinyAdminInterest)));
        assert.equal(wad4human(adminInterestPaid
            .sub(adminInterest)
            .sub(tinyAdminInterest)
            .abs())
            .slice(0, 6), "0.0000");
        assert.isTrue((await rToken.totalSupply.call()).sub(toWad(90)).eq(adminInterestPaid));
        assert.equal(wad4human(await rToken.interestPayableOf.call(admin)), "0");
    });

    it("rToken mint multiple times", async () => {
        assert.equal(wad4human(await rToken.totalSupply.call()), "0");
        await web3tx(token.approve, "token.approve 100 by customer1")(rToken.address, toWad(100), {
            from: customer1
        });

        await web3tx(rToken.mint, "rToken.mint 10 to customer1", {
            inLogs: [{
                name: "Mint"
            }]
        })(toWad(10), {
            from: customer1
        });
        assert.equal(wad4human(await rToken.interestPayableOf.call(customer1)), "0");

        await web3tx(rToken.mint, "rToken.mint 5 to customer1", {
            inLogs: [{
                name: "Mint"
            }]
        })(toWad(5), {
            from: customer1
        });

        await doBingeBorrowing();

        assert.equal(wad4human(await rToken.totalSupply.call()), "15");

        assert.equal(wad4human(await rToken.interestPayableOf.call(customer1)).slice(0, 6), "0.0099");
    });
});
