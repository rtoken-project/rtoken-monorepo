const { time, expectRevert } = require("openzeppelin-test-helpers");
const ERC20Mintable = artifacts.require("ERC20Mintable");
const ComptrollerMock = artifacts.require("ComptrollerMock");
const InterestRateModelMock = artifacts.require("InterestRateModelMock");
const CErc20 = artifacts.require("CErc20");
const RToken = artifacts.require("RToken");
const { web3tx } = require("@decentral.ee/web3-test-helpers");
const { toDecimals, fromDecimals } = require("../lib/math-utils");

function wad4human(wad, decimals = 5) {
    return Number(fromDecimals(wad.toString(), 18)).toFixed(decimals);
}

function toWad(n) {
    return web3.utils.toBN(toDecimals(n, 18));
}

contract("RToken contract", accounts => {
    //const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

    const admin = accounts[0];
    const bingeBorrower = accounts[1];
    const customer1 = accounts[2];
    const customer2 = accounts[3];
    const customer3 = accounts[4];
    const customer4 = accounts[5];
    let token;
    let cToken;
    let rToken;
    let SELF_HAT_ID;

    before(async () => {
        console.log("admin is", admin);
        console.log("bingeBorrower is", bingeBorrower);
        console.log("customer1 is", customer1);
        console.log("customer2 is", customer2);
        console.log("customer3 is", customer3);
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
        SELF_HAT_ID = await rToken.SELF_HAT_ID.call();
    });

    function parseHat({hatID, recipients, proportions}) {
        const hatObj = {
            recipients: recipients,
            proportions: proportions.map(i=>i.toNumber())
        };
        if (typeof(hatID) !== "undefined") {
            hatObj.hatID = hatID.toNumber();
        }
        return hatObj;
    }

    function parseGlobalStats({totalSupply, totalSavingsAmount}) {
        return {
            totalSupply: wad4human(totalSupply),
            totalSavingsAmount: wad4human(totalSavingsAmount)
        };
    }

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

    async function expectAccount(account, balances, decimals) {
        let accountName;
        if (account === admin) accountName = "admin";
        else if (account === customer1) accountName = "customer1";
        else if (account === customer2) accountName = "customer2";
        else if (account === customer3) accountName = "customer3";
        else if (account === customer4) accountName = "customer4";

        const tokenBalance = wad4human(await rToken.balanceOf.call(account), decimals);
        console.log(`${accountName} tokenBalance ${tokenBalance} expected ${balances.tokenBalance}`);
        assert.equal(tokenBalance, balances.tokenBalance);

        const receivedLoan = wad4human(await rToken.receivedLoanOf.call(account), decimals);
        console.log(`${accountName} receivedLoan ${receivedLoan} expected ${balances.receivedLoan}`);
        assert.equal(receivedLoan, balances.receivedLoan);

        const receivedSavings = wad4human(await rToken.receivedSavingsOf.call(account), decimals);
        console.log(`${accountName} receivedSavings ${receivedSavings} expected ${balances.receivedSavings}`);
        assert.equal(receivedSavings, balances.receivedSavings);

        const interestPayable = wad4human(await rToken.interestPayableOf.call(account), decimals);
        console.log(`${accountName} interestPayable ${interestPayable} expected ${balances.interestPayable}`);
        assert.equal(interestPayable, balances.interestPayable);

        const accountStats = await rToken.getAccountStats.call(account);

        const cumulativeInterest = wad4human(accountStats.cumulativeInterest, decimals);
        console.log(`${accountName} cumulativeInterest ${cumulativeInterest} expected ${balances.cumulativeInterest}`);
        assert.equal(cumulativeInterest, balances.cumulativeInterest);
    }

    it("#0 initial test condition", async () => {
        assert.equal(wad4human(await rToken.totalSupply.call()), "0.00000");
        assert.equal(wad4human(await cToken.balanceOf.call(customer1)), "0.00000");
        assert.equal(wad4human(await token.balanceOf.call(customer1)), "1000.00000");
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

    it("#2 rToken normal operations with zero hatter", async () => {
        await web3tx(token.approve, "token.approve 100 by customer1")(rToken.address, toWad(100), {
            from: customer1
        });
        await web3tx(rToken.mint, "rToken.mint 100 to customer1", {
            inLogs: [{
                name: "Mint"
            }]
        })(toWad(100), {
            from: customer1
        });
        assert.equal(wad4human(await token.balanceOf.call(customer1)), "900.00000");
        assert.equal(wad4human(await rToken.totalSupply.call()), "100.00000");
        await expectAccount(customer1, {
            tokenBalance: "100.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "100.00000",
            receivedSavings: "100.00000",
            interestPayable: "0.00000",
        });

        await expectRevert(rToken.transfer(customer2, toWad(100.1), { from: customer1 }), "Not enough balance to transfer");
        await expectRevert(rToken.transferFrom(customer1, customer2, toWad(1), { from: admin }), "Not enough allowance for transfer");

        await doBingeBorrowing();
        await expectAccount(customer1, {
            tokenBalance: "100.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "100.00000",
            receivedSavings: "100.00100",
            interestPayable: "0.00100",
        });
        assert.deepEqual(parseGlobalStats(await rToken.getGlobalStats.call()), {
            totalSupply: "100.00000",
            totalSavingsAmount: "100.00100"
        });

        await web3tx(rToken.redeem, "rToken.redeem 10 to customer1", {
            inLogs: [{
                name: "Redeem"
            }]
        })(toWad(10), {
            from: customer1
        });
        assert.equal(wad4human(await token.balanceOf.call(customer1)), "910.00000");
        assert.equal(wad4human(await rToken.totalSupply.call()), "90.00000");
        await expectAccount(customer1, {
            tokenBalance: "90.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "90.00000",
            receivedSavings: "90.00101",
            interestPayable: "0.00101",
        });

        await web3tx(rToken.payInterest, "rToken.payInterest to customer1", {
            inLogs: [{
                name: "InterestPaid"
            }]
        })(customer1, { from : admin });
        assert.equal(wad4human(await token.balanceOf.call(customer1)), "910.00000");
        assert.equal(wad4human(await rToken.totalSupply.call()), "90.00102");
        await expectAccount(customer1, {
            tokenBalance: "90.00102",
            cumulativeInterest: "0.00102",
            receivedLoan: "90.00000",
            receivedSavings: "90.00102",
            interestPayable: "0.00000",
        });
        await web3tx(rToken.payInterest, "rToken.payInterest to customer1 again", {
            inLogs: [{
                name: "InterestPaid"
            }]
        })(customer1, { from : admin });
        await expectAccount(customer1, {
            tokenBalance: "90.00103",
            cumulativeInterest: "0.00103",
            receivedLoan: "90.00000",
            receivedSavings: "90.00103",
            interestPayable: "0.00000",
        });
        assert.deepEqual(parseGlobalStats(await rToken.getGlobalStats.call()), {
            totalSupply: "90.00103",
            totalSavingsAmount: "90.00103"
        });
    });

    it("#3 rToken normal operations with hat", async () => {
        await web3tx(token.approve, "token.approve 100 by customer1")(rToken.address, toWad(100), {
            from: customer1
        });
        await web3tx(rToken.mintWithNewHat, "rToken.mint 100 to customer1 with a hat benefiting admin(90%) and customer2(10%)", {
            inLogs: [{
                name: "Mint"
            }]
        })(toWad(100), [admin, customer2], [90, 10], {
            from: customer1
        });
        assert.equal(wad4human(await token.balanceOf.call(customer1)), "900.00000");
        assert.equal(wad4human(await rToken.totalSupply.call()), "100.00000");
        assert.deepEqual(parseHat(await rToken.getHatByAddress.call(customer1)), {
            hatID: 1,
            recipients: [admin, customer2],
            proportions: [3865470565, 429496729]
        });
        assert.deepEqual(parseHat(await rToken.getHatByAddress.call(admin)), {
            hatID: 1,
            recipients: [admin, customer2],
            proportions: [3865470565, 429496729]
        });
        assert.deepEqual(parseHat(await rToken.getHatByAddress.call(customer2)), {
            hatID: 1,
            recipients: [admin, customer2],
            proportions: [3865470565, 429496729]
        });
        await expectAccount(customer1, {
            tokenBalance: "100.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "0.00000",
            receivedSavings: "0.00000",
            interestPayable: "0.00000",
        });
        await expectAccount(admin, {
            tokenBalance: "0.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "90.00000",
            receivedSavings: "90.00000",
            interestPayable: "0.00000",
        });
        await expectAccount(customer2, {
            tokenBalance: "0.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "10.00000",
            receivedSavings: "10.00000",
            interestPayable: "0.00000",
        });

        await doBingeBorrowing();
        assert.equal(wad4human(await rToken.totalSupply.call()), "100.00000");
        await expectAccount(customer1, {
            tokenBalance: "100.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "0.00000",
            receivedSavings: "0.00000",
            interestPayable: "0.00000",
        });
        await expectAccount(admin, {
            tokenBalance: "0.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "90.00000",
            receivedSavings: "90.00090",
            interestPayable: "0.00090",
        });
        await expectAccount(customer2, {
            tokenBalance: "0.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "10.00000",
            receivedSavings: "10.00010",
            interestPayable: "0.00010",
        });

        await web3tx(rToken.redeem, "rToken.redeem 10 to customer1", {
            inLogs: [{
                name: "Redeem"
            }]
        })(toWad(10), {
            from: customer1
        });
        assert.equal(wad4human(await token.balanceOf.call(customer1)), "910.00000");
        assert.equal(wad4human(await rToken.totalSupply.call()), "90.00000");
        await expectAccount(customer1, {
            tokenBalance: "90.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "0.00000",
            receivedSavings: "0.00000",
            interestPayable: "0.00000",
        });
        await expectAccount(admin, {
            tokenBalance: "0.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "81.00000",
            receivedSavings: "81.00091",
            interestPayable: "0.00091",
        });
        await expectAccount(customer2, {
            tokenBalance: "0.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "9.00000",
            receivedSavings: "9.00010",
            interestPayable: "0.00010",
        });

        await web3tx(rToken.transfer, "rToken.transfer 10 customer1 -> customer3", {
            inLogs: [{
                name: "Transfer"
            }]
        })(customer3, toWad(10), {
            from: customer1
        });
        assert.equal(wad4human(await rToken.totalSupply.call()), "90.00000");
        assert.deepEqual(parseHat(await rToken.getHatByAddress.call(customer3)), {
            hatID: 1,
            recipients: [admin, customer2],
            proportions: [3865470565, 429496729]
        });
        await expectAccount(customer1, {
            tokenBalance: "80.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "0.00000",
            receivedSavings: "0.00000",
            interestPayable: "0.00000",
        });
        await expectAccount(admin, {
            tokenBalance: "0.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "81.00000",
            receivedSavings: "81.00092",
            interestPayable: "0.00092",
        });
        await expectAccount(customer2, {
            tokenBalance: "0.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "9.00000",
            receivedSavings: "9.00010",
            interestPayable: "0.00010",
        });
        await expectAccount(customer3, {
            tokenBalance: "10.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "0.00000",
            receivedSavings: "0.00000",
            interestPayable: "0.00000",
        });

        assert.equal(wad4human(await rToken.balanceOf(admin)), "0.00000");
        await web3tx(rToken.payInterest, "rToken.payInterest to admin", {
            inLogs: [{
                name: "InterestPaid"
            }]
        })(admin, { from : admin });
        assert.equal(wad4human(await rToken.totalSupply.call()), "90.00093");
        await expectAccount(customer1, {
            tokenBalance: "80.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "0.00000",
            receivedSavings: "0.00000",
            interestPayable: "0.00000",
        });
        await expectAccount(admin, {
            tokenBalance: "0.00093",
            cumulativeInterest: "0.00093",
            receivedLoan: "81.00000",
            receivedSavings: "81.00093",
            interestPayable: "0.00000",
        });
        await expectAccount(customer2, {
            tokenBalance: "0.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "9.00000",
            receivedSavings: "9.00010",
            interestPayable: "0.00010",
        });
        await expectAccount(customer3, {
            tokenBalance: "10.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "0.00000",
            receivedSavings: "0.00000",
            interestPayable: "0.00000",
        });

        await waitForInterest();
        assert.equal(wad4human(await rToken.totalSupply.call()), "90.00093");
        await expectAccount(customer1, {
            tokenBalance: "80.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "0.00000",
            receivedSavings: "0.00000",
            interestPayable: "0.00000",
        });
        await expectAccount(admin, {
            tokenBalance: "0.00093",
            cumulativeInterest: "0.00093",
            receivedLoan: "81.00000",
            receivedSavings: "81.00183",
            interestPayable: "0.00090",
        });
        await expectAccount(customer2, {
            tokenBalance: "0.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "9.00000",
            receivedSavings: "9.00020",
            interestPayable: "0.00020",
        });
        await expectAccount(customer3, {
            tokenBalance: "10.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "0.00000",
            receivedSavings: "0.00000",
            interestPayable: "0.00000",
        });
    });

    it("#4 rToken mint multiple times", async () => {
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
        await expectAccount(customer1, {
            tokenBalance: "10.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "10.00000",
            receivedSavings: "10.00000",
            interestPayable: "0.00000",
        });

        await web3tx(rToken.mint, "rToken.mint 5 to customer1", {
            inLogs: [{
                name: "Mint"
            }]
        })(toWad(5), {
            from: customer1
        });
        await expectAccount(customer1, {
            tokenBalance: "15.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "15.00000",
            receivedSavings: "15.00000",
            interestPayable: "0.00000",
        });

        await doBingeBorrowing();
        await expectAccount(customer1, {
            tokenBalance: "15.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "15.00000",
            receivedSavings: "15.01000",
            interestPayable: "0.01000",
        });
    });

    it("#5 rToken redeem all including paid interests", async () => {
        await web3tx(token.approve, "token.approve 100 by customer1")(rToken.address, toWad(200), {
            from: customer1
        });
        await web3tx(rToken.mintWithNewHat, "rToken.mint 200 to customer1 with a hat benefiting customer1(10%) and customer2(90%)", {
            inLogs: [{
                name: "Mint"
            }]
        })(toWad(200), [customer1, customer2], [10, 90], {
            from: customer1
        });
        await web3tx(rToken.transfer, "rToken.transfer 190 customer1 -> customer2", {
            inLogs: [{
                name: "Transfer"
            }]
        })(customer2, toWad(100), {
            from: customer1
        });
        assert.equal(wad4human(await token.balanceOf.call(customer1)), "800.00000");
        assert.equal(wad4human(await rToken.totalSupply.call()), "200.00000");
        await expectAccount(customer1, {
            tokenBalance: "100.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "20.00000",
            receivedSavings: "20.00000",
            interestPayable: "0.00000",
        });
        await expectAccount(customer2, {
            tokenBalance: "100.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "180.00000",
            receivedSavings: "180.00000",
            interestPayable: "0.00000",
        });

        await doBingeBorrowing();
        await expectAccount(customer1, {
            tokenBalance: "100.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "20.00000",
            receivedSavings: "20.00010",
            interestPayable: "0.00010",
        });
        await expectAccount(customer2, {
            tokenBalance: "100.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "180.00000",
            receivedSavings: "180.00090",
            interestPayable: "0.00090",
        });

        await web3tx(rToken.payInterest, "rToken.payInterest to customer2", {
            inLogs: [{
                name: "InterestPaid"
            }]
        })(customer2, { from : admin });
        await expectAccount(customer1, {
            tokenBalance: "100.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "20.00000",
            receivedSavings: "20.00010",
            interestPayable: "0.00010",
        });
        await expectAccount(customer2, {
            tokenBalance: "100.00091",
            cumulativeInterest: "0.00091",
            receivedLoan: "180.00000",
            receivedSavings: "180.00091",
            interestPayable: "0.00000",
        });
        assert.equal(wad4human(await rToken.totalSupply.call()), "200.00091");

        assert.equal(wad4human(await token.balanceOf.call(customer2)), "0.00000");
        const customer2RBalance = web3.utils.toBN(await rToken.balanceOf.call(customer2));
        await expectRevert(rToken.redeem(customer2RBalance.add(web3.utils.toBN(0))), "Not enough balance to redeem");
        await web3tx(rToken.redeem, "rToken.redeem maximum to customer2", {
            inLogs: [{
                name: "Redeem"
            }]
        })(customer2RBalance, {
            from: customer2
        });
        assert.isTrue((await token.balanceOf.call(customer2)).eq(customer2RBalance));
        assert.equal(wad4human(await rToken.totalSupply.call()), "100.00000");
    });

    it("#6 transfer and switch hats", async () => {
        await web3tx(rToken.createHat, "rToken.createHat for customer1 benefiting admin and customer3 10/90")(
            [admin, customer3], [10, 90], true, {
                from: customer1
            }
        );
        assert.deepEqual(parseHat(await rToken.getHatByAddress.call(customer1)), {
            hatID: 1,
            recipients: [admin, customer3],
            proportions: [429496729, 3865470565]
        });
        await web3tx(rToken.createHat, "rToken.createHat for customer2 benefiting admin and customer4 20/80")(
            [admin, customer4], [20, 80], true, {
                from: customer2
            }
        );
        assert.deepEqual(parseHat(await rToken.getHatByAddress.call(customer2)), {
            hatID: 2,
            recipients: [admin, customer4],
            proportions: [858993459, 3435973836]
        });

        await web3tx(token.approve, "token.approve 100 by customer1")(rToken.address, toWad(200), {
            from: customer1
        });
        await web3tx(rToken.mint, "rToken.mint 100 to customer1")(
            toWad(200), {
                from: customer1
            });
        await expectAccount(admin, {
            tokenBalance: "0.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "20.00000",
            receivedSavings: "20.00000",
            interestPayable: "0.00000",
        });
        await expectAccount(customer1, {
            tokenBalance: "200.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "0.00000",
            receivedSavings: "0.00000",
            interestPayable: "0.00000",
        });
        await expectAccount(customer2, {
            tokenBalance: "0.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "0.00000",
            receivedSavings: "0.00000",
            interestPayable: "0.00000",
        });
        await expectAccount(customer3, {
            tokenBalance: "0.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "180.00000",
            receivedSavings: "180.00000",
            interestPayable: "0.00000",
        });
        await expectAccount(customer4, {
            tokenBalance: "0.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "0.00000",
            receivedSavings: "0.00000",
            interestPayable: "0.00000",
        });

        await web3tx(rToken.transfer, "rToken.transfer 100 from customer1 to customer 2")(
            customer2, toWad(100), {
                from: customer1
            });
        await expectAccount(admin, {
            tokenBalance: "0.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "30.00000",
            receivedSavings: "30.00000",
            interestPayable: "0.00000",
        });
        await expectAccount(customer1, {
            tokenBalance: "100.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "0.00000",
            receivedSavings: "0.00000",
            interestPayable: "0.00000",
        });
        await expectAccount(customer2, {
            tokenBalance: "100.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "0.00000",
            receivedSavings: "0.00000",
            interestPayable: "0.00000",
        });
        await expectAccount(customer3, {
            tokenBalance: "0.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "90.00000",
            receivedSavings: "90.00000",
            interestPayable: "0.00000",
        });
        await expectAccount(customer4, {
            tokenBalance: "0.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "80.00000",
            receivedSavings: "80.00000",
            interestPayable: "0.00000",
        });

        await doBingeBorrowing();
        await expectAccount(admin, {
            tokenBalance: "0.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "30.00000",
            receivedSavings: "30.00015",
            interestPayable: "0.00015",
        });
        await expectAccount(customer1, {
            tokenBalance: "100.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "0.00000",
            receivedSavings: "0.00000",
            interestPayable: "0.00000",
        });
        await expectAccount(customer2, {
            tokenBalance: "100.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "0.00000",
            receivedSavings: "0.00000",
            interestPayable: "0.00000",
        });
        await expectAccount(customer3, {
            tokenBalance: "0.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "90.00000",
            receivedSavings: "90.00045",
            interestPayable: "0.00045",
        });
        await expectAccount(customer4, {
            tokenBalance: "0.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "80.00000",
            receivedSavings: "80.00040",
            interestPayable: "0.00040",
        });
    });

    it("#7 rToken redeem all including paid interest for zero hatter", async () => {
        // let customer2 provide some reserve
        await web3tx(token.transfer, "token.transfer 100 from customer 1 to customer 2")(
            customer2, toWad(100), {
                from: customer1
            }
        );
        await web3tx(token.approve, "token.approve 100 by customer2")(rToken.address, toWad(100), {
            from: customer2
        });
        await web3tx(rToken.mint, "rToken.mint 100 to customer2")(toWad(100), {
            from: customer2
        });

        await web3tx(token.approve, "token.approve 100 by customer1")(rToken.address, toWad(100), {
            from: customer1
        });
        await web3tx(rToken.mint, "rToken.mint 100 to customer1")(toWad(100), {
            from: customer1
        });

        await doBingeBorrowing();
        await web3tx(rToken.payInterest, "rToken.payInterest to customer1")(
            customer1, { from : admin });
        await expectAccount(customer1, {
            tokenBalance: "100.00051",
            receivedLoan: "100.00000",
            receivedSavings: "100.00051",
            interestPayable: "0.00000",
            cumulativeInterest: "0.00051",
        });

        const customer1RBalance1 = await rToken.balanceOf.call(customer1);
        await web3tx(rToken.redeem, "rToken.redeem all to customer1")(customer1RBalance1, {
            from: customer1
        });
        assert.equal(wad4human(await token.balanceOf.call(customer1)), "900.00051");
        await expectAccount(customer1, {
            tokenBalance: "0.0000",
            receivedLoan: "0.0000",
            receivedSavings: "0.0000",
            interestPayable: "0.0000",
            cumulativeInterest: "0.0005",
        }, 4);

        // mint again
        await web3tx(token.approve, "token.approve 100 by customer1")(rToken.address, toWad(100), {
            from: customer1
        });
        await web3tx(rToken.mint, "rToken.mint 100 to customer1")(toWad(100), {
            from: customer1
        });

        await waitForInterest();
        await web3tx(rToken.payInterest, "rToken.payInterest to customer1")(
            customer1, { from : admin });
        await expectAccount(customer1, {
            tokenBalance: "100.00051",
            receivedLoan: "100.00000",
            receivedSavings: "100.00051",
            interestPayable: "0.00000",
            cumulativeInterest: "0.00102",
        });

        const customer1RBalance2 = await rToken.balanceOf.call(customer1);
        await web3tx(rToken.transfer, "rToken.transfer all from customer1 to customer2")(
            customer2, customer1RBalance2, {
                from: customer1
            });
        await expectAccount(customer1, {
            tokenBalance: "0.0000",
            receivedLoan: "0.0000",
            receivedSavings: "0.0000",
            interestPayable: "0.0000",
            cumulativeInterest: "0.0010",
        }, 4);

        // mint yet again
        await web3tx(token.approve, "token.approve 100 by customer1")(rToken.address, toWad(100), {
            from: customer1
        });
        await web3tx(rToken.mint, "rToken.mint 100 to customer1")(toWad(100), {
            from: customer1
        });

        await waitForInterest();
        await web3tx(rToken.payInterest, "rToken.payInterest to customer1")(
            customer1, { from : admin });
        await expectAccount(customer1, {
            tokenBalance: "100.0003",
            receivedLoan: "100.0000",
            receivedSavings: "100.0003",
            interestPayable: "0.0000",
            cumulativeInterest: "0.0014",
        }, 4);
    });

    it("#8 special hats", async () => {
        assert.deepEqual(parseHat(await rToken.getHatByID.call(0)), {
            recipients: [],
            proportions: []
        });
        assert.deepEqual(parseHat(await rToken.getHatByID.call(SELF_HAT_ID)), {
            recipients: [],
            proportions: []
        });
    });

    it("#9 rToken operations with self hatter", async () => {
        await web3tx(token.approve, "token.approve 100 by customer1")(rToken.address, toWad(100), {
            from: customer1
        });
        await expectRevert(rToken.mintWithSelectedHat(toWad(1), 1), "Invalid hat ID");
        await web3tx(rToken.mintWithSelectedHat, "rToken.mintWithSelectedHat 100 to customer1 with the self hat", {
            inLogs: [{
                name: "Mint"
            }]
        })(toWad(100), await rToken.SELF_HAT_ID.call(), {
            from: customer1
        });
        assert.equal(wad4human(await token.balanceOf.call(customer1)), "900.00000");
        assert.equal(wad4human(await rToken.totalSupply.call()), "100.00000");
        await expectAccount(customer1, {
            tokenBalance: "100.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "100.00000",
            receivedSavings: "100.00000",
            interestPayable: "0.00000",
        });

        await web3tx(rToken.transfer, "rToken.transfer all from customer1 to customer2")(
            customer2, toWad(20), {
                from: customer1
            });
        await expectAccount(customer1, {
            tokenBalance: "80.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "80.00000",
            receivedSavings: "80.00000",
            interestPayable: "0.00000",
        });
        await expectAccount(customer2, {
            tokenBalance: "20.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "20.00000",
            receivedSavings: "20.00000",
            interestPayable: "0.00000",
        });
    });
});
