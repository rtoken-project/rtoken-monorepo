const ERC20Mintable = artifacts.require("ERC20Mintable");
const CErc20 = artifacts.require("CErc20");
const ComptrollerMock = artifacts.require("ComptrollerMock");
const InterestRateModelMock = artifacts.require("InterestRateModelMock");
const CompoundAllocationStrategy = artifacts.require("CompoundAllocationStrategy");
const RToken = artifacts.require("RToken");
const Proxy = artifacts.require("Proxy");
const { time, expectRevert } = require("openzeppelin-test-helpers");
const { web3tx, wad4human, toWad } = require("@decentral.ee/web3-test-helpers");

contract("RToken", accounts => {
    const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

    const admin = accounts[0];
    const bingeBorrower = accounts[1];
    const customer1 = accounts[2];
    const customer2 = accounts[3];
    const customer3 = accounts[4];
    const customer4 = accounts[5];
    let token;
    let cToken;
    let compoundAS;
    let rToken;
    let rTokenLogic;
    let SELF_HAT_ID;


    async function createCompoundAllocationStrategy(cTokenExchangeRate) {
        const comptroller = await web3tx(ComptrollerMock.new, "ComptrollerMock.new")({ from: admin });
        const interestRateModel = await web3tx(InterestRateModelMock.new, "InterestRateModelMock.new")({ from: admin });
        const cToken = await web3tx(CErc20.new, "CErc20.new")(
            token.address,
            comptroller.address,
            interestRateModel.address,
            cTokenExchangeRate, // 1 cToken == cTokenExchangeRate * token
            "Compound token",
            "cToken",
            18, {
                from: admin
            });
        const compoundAS = await web3tx(CompoundAllocationStrategy.new, "CompoundAllocationStrategy.new")(
            cToken.address, {
                from: admin
            }
        );
        return { cToken, compoundAS };
    }

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

        {
            const result = await createCompoundAllocationStrategy(toWad(.1));
            cToken = result.cToken;
            compoundAS = result.compoundAS;
        }

        // Deploy the rToken logic/library contract
        rTokenLogic = await web3tx(RToken.new, "RToken.new")(
            {
                from: admin
            });
        // Get the init code for rToken
        const rTokenConstructCode = rTokenLogic.contract.methods.initialize(
            compoundAS.address,
            "RToken Test",
            "RTOKEN",
            18).encodeABI();

        // Deploy the Proxy, using the init code for rToken
        const proxy = await web3tx(Proxy.new, "Proxy.new")(
            rTokenConstructCode, rTokenLogic.address, {
                from: admin
            });
        // Create the rToken object using the proxy address
        rToken = await RToken.at(proxy.address);

        await web3tx(compoundAS.transferOwnership, "compoundAS.transferOwnership")(rToken.address);
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

    function parseHatStats({useCount, totalLoans, totalSavings}) {
        return {
            useCount,
            totalLoans: wad4human(totalLoans),
            totalSavings: wad4human(totalSavings)
        };
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
        assert.equal(tokenBalance, balances.tokenBalance, `${accountName} tokenBalance`);

        const receivedLoan = wad4human(await rToken.receivedLoanOf.call(account), decimals);
        console.log(`${accountName} receivedLoan ${receivedLoan} expected ${balances.receivedLoan}`);
        assert.equal(receivedLoan, balances.receivedLoan, `${accountName} receivedLoan`);

        const receivedSavings = wad4human(await rToken.receivedSavingsOf.call(account), decimals);
        console.log(`${accountName} receivedSavings ${receivedSavings} expected ${balances.receivedSavings}`);
        assert.equal(receivedSavings, balances.receivedSavings, `${accountName} receivedSavings`);

        const interestPayable = wad4human(await rToken.interestPayableOf.call(account), decimals);
        console.log(`${accountName} interestPayable ${interestPayable} expected ${balances.interestPayable}`);
        assert.equal(interestPayable, balances.interestPayable, `${accountName} interestPayable`);

        const accountStats = await rToken.getAccountStats.call(account);

        const cumulativeInterest = wad4human(accountStats.cumulativeInterest, decimals);
        console.log(`${accountName} cumulativeInterest ${cumulativeInterest} expected ${balances.cumulativeInterest}`);
        assert.equal(cumulativeInterest, balances.cumulativeInterest, `${accountName} cumulativeInterest`);
    }

    it("#0 initial test condition", async () => {
        assert.equal(wad4human(await rToken.totalSupply.call()), "0.00000");
        assert.equal(wad4human(await cToken.balanceOf.call(customer1)), "0.00000");
        assert.equal(wad4human(await token.balanceOf.call(customer1)), "1000.00000");
    });

    it("#2 rToken normal operations with zero hatter", async () => {
        await web3tx(token.approve, "token.approve 100 by customer1")(rToken.address, toWad(100), {
            from: customer1
        });
        await web3tx(rToken.mint, "rToken.mint 100 to customer1", {
            inLogs: [{
                name: "Transfer",
                args: {
                    from: ZERO_ADDRESS,
                    to: customer1,
                    value: toWad(100)
                }
            }]
        })(toWad(100), {
            from: customer1
        });
        assert.equal(wad4human(await token.balanceOf.call(customer1)), "900.00000");
        assert.equal(wad4human(await rToken.balanceOf.call(customer1)), "100.00000");
        await expectAccount(customer1, {
            tokenBalance: "100.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "100.00000",
            totalLoans: "100.00000",
            totalSavings: "100.00000",
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
                name: "Transfer",
                args: {
                    from: customer1,
                    to: ZERO_ADDRESS,
                    value: toWad(10)
                }
            }]
        })(toWad(10), {
            from: customer1
        });
        assert.equal(wad4human(await token.balanceOf.call(customer1)), "910.00000");
        assert.equal(wad4human(await rToken.balanceOf.call(customer1)), "90.00101");
        await expectAccount(customer1, {
            tokenBalance: "90.00101",
            cumulativeInterest: "0.00101",
            receivedLoan: "90.00000",
            receivedSavings: "90.00101",
            interestPayable: "0.00000",
        });

        await web3tx(rToken.payInterest, "rToken.payInterest to customer1", {
            inLogs: [{
                name: "InterestPaid"
            }, {
                name: "Transfer",
                args: {
                    from: ZERO_ADDRESS,
                    to: customer1
                    // value: // who knows
                }
            }]
        })(customer1, { from : admin });
        assert.equal(wad4human(await token.balanceOf.call(customer1)), "910.00000");
        assert.equal(wad4human(await rToken.balanceOf.call(customer1)), "90.00102");
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

        await web3tx(rToken.redeemAndTransfer, "rToken.redeem 2 of customer1 to customer3", {
            inLogs: [{
                name: "Transfer",
                args: {
                    from: customer1,
                    to: ZERO_ADDRESS,
                    value: toWad(2)
                }
            }]
        })(customer3, toWad(2), {
            from: customer1
        });
        assert.equal(wad4human(await token.balanceOf.call(customer3)), "2.00000");
    });

    it("#3 rToken normal operations with hat", async () => {
        await web3tx(token.approve, "token.approve 100 by customer1")(rToken.address, toWad(100), {
            from: customer1
        });
        await web3tx(rToken.mintWithNewHat, "rToken.mint 100 to customer1 with a hat benefiting admin(90%) and customer2(10%)", {
            inLogs: [{
                name: "Transfer"
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
            hatID: 0,
            recipients: [],
            proportions: []
        });
        assert.deepEqual(parseHat(await rToken.getHatByAddress.call(customer2)), {
            hatID: 0,
            recipients: [],
            proportions: []
        });
        assert.deepEqual(parseHatStats(await rToken.getHatStats(1)), {
            useCount: "1",
            totalLoans: "100.00000",
            totalSavings: "100.00000",
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
                name: "Transfer"
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

        assert.deepEqual(parseHatStats(await rToken.getHatStats(1)), {
            useCount: "2",
            totalLoans: "90.00000",
            totalSavings: "90.00203",
        });
    });

    it("#4 rToken mint multiple times", async () => {
        await web3tx(token.approve, "token.approve 100 by customer1")(rToken.address, toWad(100), {
            from: customer1
        });
        await web3tx(rToken.mint, "rToken.mint 10 to customer1", {
            inLogs: [{
                name: "Transfer"
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
                name: "Transfer"
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
                name: "Transfer"
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
                name: "Transfer"
            }]
        })(customer2RBalance, {
            from: customer2
        });
        assert.isTrue((await token.balanceOf.call(customer2)).eq(customer2RBalance));
        assert.equal(wad4human(await rToken.totalSupply.call()), "100.00002");
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
                name: "Transfer"
            }]
        })(toWad(100), await rToken.SELF_HAT_ID.call(), {
            from: customer1
        });
        assert.equal(wad4human(await token.balanceOf.call(customer1)), "900.00000");
        assert.equal(wad4human(await rToken.balanceOf.call(customer1)), "100.00000");
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

        await web3tx(rToken.changeHat, "rToken changeHat for customer3 with selfhat")(
            SELF_HAT_ID, {
                from: customer3
            }
        );
        await web3tx(rToken.transfer, "rToken.transfer all from customer1 to customer3")(
            customer3, toWad(20), {
                from: customer1
            });
        await expectAccount(customer1, {
            tokenBalance: "60.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "60.00000",
            receivedSavings: "60.00000",
            interestPayable: "0.00000",
        });
        await expectAccount(customer3, {
            tokenBalance: "20.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "20.00000",
            receivedSavings: "20.00000",
            interestPayable: "0.00000",
        });

        await doBingeBorrowing();

        await expectAccount(customer1, {
            tokenBalance: "60.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "60.00000",
            receivedSavings: "60.00060",
            interestPayable: "0.00060",
        });
        await expectAccount(customer2, {
            tokenBalance: "20.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "20.00000",
            receivedSavings: "20.00020",
            interestPayable: "0.00020",
        });
        await expectAccount(customer3, {
            tokenBalance: "20.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "20.00000",
            receivedSavings: "20.00020",
            interestPayable: "0.00020",
        });
    });

    it("#10 CompoundAs ownership protection", async () => {
        await web3tx(token.approve, "token.approve 100 by customer1")(rToken.address, toWad(100), {
            from: customer1
        });
        await web3tx(rToken.mintWithSelectedHat, "rToken.mintWithSelectedHat 100 to customer1 with the self hat", {
            inLogs: [{
                name: "Transfer"
            }]
        })(toWad(100), await rToken.SELF_HAT_ID.call(), {
            from: customer1
        });
        await expectRevert(web3tx(compoundAS.redeemUnderlying, "redeemUnderlying by admin")(toWad(100), {
            from: admin
        }), "Ownable: caller is not the owner");
    });

    it("#11 transferAll", async () => {
        await web3tx(token.approve, "token.approve 100 by customer1")(rToken.address, toWad(100), {
            from: customer1
        });
        await web3tx(rToken.mintWithSelectedHat, "rToken.mintWithSelectedHat 100 to customer1 with the self hat", {
            inLogs: [{
                name: "Transfer"
            }]
        })(toWad(100), await rToken.SELF_HAT_ID.call(), {
            from: customer1
        });

        await doBingeBorrowing();

        await web3tx(rToken.transferAll, "rToken.transferAll from customer1 to customer2", {
            inLogs: [{
                name: "InterestPaid"
            }, {
                name: "Transfer"
            }]
        })(customer2, {
            from: customer1
        });
        await expectAccount(customer1, {
            tokenBalance: "0.00000",
            cumulativeInterest: "0.00101",
            receivedLoan: "0.00000",
            receivedSavings: "0.00000",
            interestPayable: "0.00000",
        });
        await expectAccount(customer2, {
            tokenBalance: "100.00101",
            cumulativeInterest: "0.00000",
            receivedLoan: "100.00101",
            receivedSavings: "100.00101",
            interestPayable: "0.00000",
        });
    });

    it("#12 redeemAll", async () => {
        await web3tx(token.approve, "token.approve 100 by customer1")(rToken.address, toWad(100), {
            from: customer1
        });
        await web3tx(rToken.mintWithSelectedHat, "rToken.mintWithSelectedHat 100 to customer1 with the self hat", {
            inLogs: [{
                name: "Transfer"
            }]
        })(toWad(100), await rToken.SELF_HAT_ID.call(), {
            from: customer1
        });

        await web3tx(token.transfer, "token.transfer 100 from customer 1 to customer 2")(
            customer2, toWad(100), {
                from: customer1
            }
        );
        await web3tx(token.approve, "token.approve 100 by customer2")(rToken.address, toWad(100), {
            from: customer2
        });
        await web3tx(rToken.mintWithSelectedHat, "rToken.mintWithSelectedHat 100 to customer2 with the self hat", {
            inLogs: [{
                name: "Transfer"
            }]
        })(toWad(100), await rToken.SELF_HAT_ID.call(), {
            from: customer2
        });

        await doBingeBorrowing();

        await web3tx(rToken.redeemAll, "rToken.redeemAll for customer1", {
            inLogs: [{
                name: "InterestPaid"
            }, {
                name: "Transfer"
            }]
        })({
            from: customer1
        });
        await expectAccount(customer1, {
            tokenBalance: "0.00000",
            cumulativeInterest: "0.00051",
            receivedLoan: "0.00000",
            receivedSavings: "0.00000",
            interestPayable: "0.00000",
        });
        assert.equal(wad4human(await token.balanceOf.call(customer1)), "900.00051");
    });

    it("#13 approve & transferFrom & transferAllFrom", async () => {
        await web3tx(token.approve, "token.approve 100 by customer1")(rToken.address, toWad(100), {
            from: customer1
        });
        await web3tx(rToken.mintWithSelectedHat, "rToken.mintWithSelectedHat 100 to customer1 with the self hat", {
            inLogs: [{
                name: "Transfer"
            }]
        })(toWad(100), await rToken.SELF_HAT_ID.call(), {
            from: customer1
        });
        await web3tx(rToken.approve, "token.approve customer 2 by customer1")(customer2, toWad(50), {
            from: customer1
        });
        assert.isTrue((await rToken.allowance.call(customer1, customer2)).eq(toWad(50)));
        await expectRevert(web3tx(rToken.transferFrom, "rToken transferFrom customer1 -> customer3 by customer2 more than approved")(
            customer1, customer3,
            toWad(50).add(web3.utils.toBN(1)), {
                from: customer2
            }), "Not enough allowance for transfer");
        await web3tx(rToken.transferFrom, "rToken transferFrom customer1 -> customer3 by customer2 all approved")(
            customer1, customer3,
            toWad(50), {
                from: customer2
            });
        assert.isTrue((await rToken.allowance.call(customer1, customer2)).eq(toWad(0)));
        await web3tx(rToken.approve, "token.approve customer 2 by customer1")(customer2, toWad(10000), {
            from: customer1
        });

        await doBingeBorrowing();

        await web3tx(rToken.transferAllFrom, "rToken transferAllFrom customer1 -> customer3 by customer2")(
            customer1, customer3, {
                from: customer2
            });
        await expectAccount(customer1, {
            tokenBalance: "0.00000",
            cumulativeInterest: "0.00051",
            receivedLoan: "0.00000",
            receivedSavings: "0.00000",
            interestPayable: "0.00000",
        });
        await expectAccount(customer3, {
            tokenBalance: "100.00101",
            cumulativeInterest: "0.00051",
            receivedLoan: "100.00051",
            receivedSavings: "100.00101",
            interestPayable: "0.00000",
        });
    });

    it("#14 redeemAndTransferAll", async () => {
        await web3tx(token.approve, "token.approve 100 by customer1")(rToken.address, toWad(100), {
            from: customer1
        });
        await web3tx(rToken.mintWithSelectedHat, "rToken.mintWithSelectedHat 100 to customer1 with the self hat", {
            inLogs: [{
                name: "Transfer"
            }]
        })(toWad(100), await rToken.SELF_HAT_ID.call(), {
            from: customer1
        });

        await web3tx(token.transfer, "token.transfer 100 from customer 1 to customer 2")(
            customer2, toWad(100), {
                from: customer1
            }
        );
        await web3tx(token.approve, "token.approve 100 by customer2")(rToken.address, toWad(100), {
            from: customer2
        });
        await web3tx(rToken.mintWithSelectedHat, "rToken.mintWithSelectedHat 100 to customer2 with the self hat", {
            inLogs: [{
                name: "Transfer"
            }]
        })(toWad(100), await rToken.SELF_HAT_ID.call(), {
            from: customer2
        });

        await doBingeBorrowing();

        await web3tx(rToken.redeemAndTransferAll, "rToken.redeemAndTransferAll for customer1", {
            inLogs: [{
                name: "InterestPaid"
            }, {
                name: "Transfer"
            }]
        })(customer3, {
            from: customer1
        });
        await expectAccount(customer1, {
            tokenBalance: "0.00000",
            cumulativeInterest: "0.00051",
            receivedLoan: "0.00000",
            receivedSavings: "0.00000",
            interestPayable: "0.00000",
        });
        assert.equal(wad4human(await token.balanceOf.call(customer1)), "800.00000");
        assert.equal(wad4human(await token.balanceOf.call(customer3)), "100.00051");
    });

    it("#15 upgrade contract", async () => {
        // Deploy the new rToken logic/library contract
        const newRTokenLogic = await web3tx(RToken.new, "RToken.new")(
            {
                from: admin
            });

        // Perform the upgrade
        await web3tx(rToken.updateCode, "rToken.updateCode", {
            inLogs: [{
                name: "CodeUpdated",
                args: {
                    newCode: newRTokenLogic.address
                }
            }]
        })(newRTokenLogic.address, {
            from: admin
        });

        // Below is just copy of test #2 rToken normal operations with zero hatter
        await web3tx(token.approve, "token.approve 100 by customer1")(rToken.address, toWad(100), {
            from: customer1
        });
        await web3tx(rToken.mint, "rToken.mint 100 to customer1", {
            inLogs: [{
                name: "Transfer",
                args: {
                    from: ZERO_ADDRESS,
                    to: customer1,
                    value: toWad(100)
                }
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
                name: "Transfer",
                args: {
                    from: customer1,
                    to: ZERO_ADDRESS,
                    value: toWad(10)
                }
            }]
        })(toWad(10), {
            from: customer1
        });
        assert.equal(wad4human(await token.balanceOf.call(customer1)), "910.00000");
        assert.equal(wad4human(await rToken.totalSupply.call()), "90.00101");
        await expectAccount(customer1, {
            tokenBalance: "90.00101",
            cumulativeInterest: "0.00101",
            receivedLoan: "90.00000",
            receivedSavings: "90.00101",
            interestPayable: "0.00000",
        });

        await web3tx(rToken.payInterest, "rToken.payInterest to customer1", {
            inLogs: [{
                name: "InterestPaid"
            }, {
                name: "Transfer",
                args: {
                    from: ZERO_ADDRESS,
                    to: customer1
                    // value: // who knows
                }
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

        await web3tx(rToken.redeemAndTransfer, "rToken.redeem 2 of customer1 to customer3", {
            inLogs: [{
                name: "Transfer",
                args: {
                    from: customer1,
                    to: ZERO_ADDRESS,
                    value: toWad(2)
                }
            }]
        })(customer3, toWad(2), {
            from: customer1
        });
        assert.equal(wad4human(await token.balanceOf.call(customer3)), "2.00000");
    });

    it("#16 proxy security", async () => {

        // Call initialize first time
        await web3tx(rTokenLogic.initialize, "rTokenLogic.initialize first time")(
            compoundAS.address,
            "RToken Test",
            "RTOKEN",
            18, {
                from: admin
            });

        // Test original logic contract
        await expectRevert(web3tx(rTokenLogic.initialize, "rTokenLogic.initialize second time")(
            compoundAS.address,
            "RToken Test",
            "RTOKEN",
            18,
            {
                from: admin
            }), "The library has already been initialized.");

        await expectRevert(web3tx(rTokenLogic.updateCode, "rTokenLogic.updateCode from non-owner")(compoundAS.address, {
            from: customer1
        }), "Ownable: caller is not the owner");

        // await expectRevert(web3tx(rTokenLogic.updateCode, "rTokenLogic.updateCode from owner")(compoundAS.address, {
        //   from: admin
        // }), "The library is locked. No direct 'call' is allowed.");

        // Test original proxy contract
        await expectRevert(web3tx(rToken.initialize, "rToken.initialize (original)")(
            compoundAS.address,
            "RToken Test",
            "RTOKEN",
            18, {
                from: admin
            }), "The library has already been initialized.");

        await expectRevert(web3tx(rToken.updateCode, "rToken.updateCode (original)")(compoundAS.address, {
            from: customer1
        }), "Ownable: caller is not the owner");

        // Deploy new rToken logic/library contract
        const newRTokenLogic = await web3tx(RToken.new, "RToken.new")(
            {
                from: admin
            });
        // Perform the upgrade
        await web3tx(rToken.updateCode, "rToken.updateCode")(newRTokenLogic.address, {
            from: admin
        });

        // Call initialize first time
        await web3tx(newRTokenLogic.initialize, "rTokenLogic.initialize first time")(
            compoundAS.address,
            "RToken Test",
            "RTOKEN",
            18, {
                from: admin
            });

        // Test new logic contract
        await expectRevert(web3tx(newRTokenLogic.initialize, "rTokenLogic.initialize second time")(
            compoundAS.address,
            "RToken Test",
            "RTOKEN",
            18, {
                from: admin
            }), "The library has already been initialized.");

        await expectRevert(web3tx(newRTokenLogic.updateCode, "rTokenLogic.updateCode from non-owner")(compoundAS.address, {
            from: customer1
        }), "Ownable: caller is not the owner");

        // await expectRevert(web3tx(rTokenLogic.updateCode, "rTokenLogic.updateCode from owner")(compoundAS.address, {
        //   from: admin
        // }), "The library is locked. No direct 'call' is allowed.");

        // Test new proxy contract
        await expectRevert(web3tx(rToken.initialize, "rToken.initialize (original)")(
            compoundAS.address,
            "RToken Test",
            "RTOKEN",
            18, {
                from: admin
            }), "The library has already been initialized.");

        await expectRevert(web3tx(rToken.updateCode, "rToken.updateCode (original)")(compoundAS.address, {
            from: customer1
        }), "Ownable: caller is not the owner");

    });

    it("#17 storage continuity during upgrade", async () => {
        // Test to ensure storage is not disrupted by performing an upgrade.
        await web3tx(token.approve, "token.approve 100 by customer1")(
            rToken.address,
            toWad(100),
            {
                from: customer1
            }
        );
        await web3tx(rToken.mint, "rToken.mint 100 to customer1", {
            inLogs: [
                {
                    name: "Transfer",
                    args: {
                        from: ZERO_ADDRESS,
                        to: customer1,
                        value: toWad(100)
                    }
                }
            ]
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
            interestPayable: "0.00000"
        });

        await expectRevert(
            rToken.transfer(customer2, toWad(100.1), {from: customer1}),
            "Not enough balance to transfer"
        );
        await expectRevert(
            rToken.transferFrom(customer1, customer2, toWad(1), {from: admin}),
            "Not enough allowance for transfer"
        );

        await doBingeBorrowing();
        await expectAccount(customer1, {
            tokenBalance: "100.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "100.00000",
            receivedSavings: "100.00100",
            interestPayable: "0.00100"
        });
        assert.deepEqual(parseGlobalStats(await rToken.getGlobalStats.call()), {
            totalSupply: "100.00000",
            totalSavingsAmount: "100.00100"
        });

        await web3tx(rToken.redeem, "rToken.redeem 10 to customer1", {
            inLogs: [
                {
                    name: "Transfer",
                    args: {
                        from: customer1,
                        to: ZERO_ADDRESS,
                        value: toWad(10)
                    }
                }
            ]
        })(toWad(10), {
            from: customer1
        });

        assert.equal(wad4human(await token.balanceOf.call(customer1)), "910.00000");
        assert.equal(wad4human(await rToken.totalSupply.call()), "90.00101");
        await expectAccount(customer1, {
            tokenBalance: "90.00101",
            cumulativeInterest: "0.00101",
            receivedLoan: "90.00000",
            receivedSavings: "90.00101",
            interestPayable: "0.00000"
        });

        await web3tx(rToken.payInterest, "rToken.payInterest to customer1", {
            inLogs: [
                {
                    name: "InterestPaid"
                },
                {
                    name: "Transfer",
                    args: {
                        from: ZERO_ADDRESS,
                        to: customer1
                        // value: // who knows
                    }
                }
            ]
        })(customer1, {from: admin});
        assert.equal(wad4human(await token.balanceOf.call(customer1)), "910.00000");
        assert.equal(wad4human(await rToken.totalSupply.call()), "90.00102");
        await expectAccount(customer1, {
            tokenBalance: "90.00102",
            cumulativeInterest: "0.00102",
            receivedLoan: "90.00000",
            receivedSavings: "90.00102",
            interestPayable: "0.00000"
        });
        // Deploy the new rToken logic/library contract
        const newRTokenLogic = await web3tx(RToken.new, "RToken.new")({
            from: admin
        });
        // Perform the upgrade
        await web3tx(rToken.updateCode, "rToken.updateCode")(
            newRTokenLogic.address,
            {
                from: admin
            }
        );
        await web3tx(rToken.payInterest, "rToken.payInterest to customer1 again", {
            inLogs: [
                {
                    name: "InterestPaid"
                }
            ]
        })(customer1, {from: admin});
        await expectAccount(customer1, {
            tokenBalance: "90.00105",
            cumulativeInterest: "0.00105",
            receivedLoan: "90.00000",
            receivedSavings: "90.00105",
            interestPayable: "0.00000"
        });
        assert.deepEqual(parseGlobalStats(await rToken.getGlobalStats.call()), {
            totalSupply: "90.00105",
            totalSavingsAmount: "90.00105"
        });

        await web3tx(
            rToken.redeemAndTransfer,
            "rToken.redeem 2 of customer1 to customer3",
            {
                inLogs: [
                    {
                        name: "Transfer",
                        args: {
                            from: customer1,
                            to: ZERO_ADDRESS,
                            value: toWad(2)
                        }
                    }
                ]
            }
        )(customer3, toWad(2), {
            from: customer1
        });
        assert.equal(wad4human(await token.balanceOf.call(customer3)), "2.00000");
    });

    it("#18 admin.changeHatFor", async () => {
        await web3tx(token.approve, "token.approve 100 by customer1")(rToken.address, toWad(100), {
            from: customer1
        });
        await web3tx(rToken.mintWithNewHat, "rToken.mint 100 to customer1 with a hat benefiting admin(90%) and customer2(10%)", {
            inLogs: [{
                name: "Transfer"
            }]
        })(toWad(100), [admin, customer2], [90, 10], {
            from: customer1
        });

        assert.deepEqual(parseHatStats(await rToken.getHatStats(1)), {
            useCount: "1",
            totalLoans: "100.00000",
            totalSavings: "100.00000",
        });

        await expectRevert(web3tx(rToken.changeHatFor, "rToken.changeHatFor by customer1")(
            cToken.address, 1, {
                from: customer1
            }
        ), "Ownable: caller is not the owner");
        await web3tx(rToken.changeHatFor, "rToken.changeHatFor by customer1")(
            cToken.address, 1, {
                from: admin
            }
        );
        assert.deepEqual(parseHatStats(await rToken.getHatStats(1)), {
            useCount: "2",
            totalLoans: "100.00000",
            totalSavings: "100.00000",
        });

        await expectRevert(web3tx(rToken.changeHatFor, "rToken.changeHatFor by customer1")(
            customer3, 1, {
                from: admin
            }
        ), "Admin can only change hat for contract address");
    });

    it("#19 Max hat numbers & same hat optimization", async () => {
        let tx;

        await web3tx(token.approve, "token.approve 100 by customer1")(rToken.address, toWad(100), {
            from: customer1
        });

        // build a sombrero
        const sombrero = { addresses: [], proportions: []};
        for (let i = 1; i <= 50; ++i) {
            sombrero.addresses.push(`0x${i}000000000000000000000000000000000000000`.substr(0, 42));
            sombrero.proportions.push(1);
        }

        await web3tx(rToken.mintWithNewHat, "rToken.mint 100 to customer1 with a sombreror", {
            inLogs: [{
                name: "Transfer"
            }]
        })(toWad(100), sombrero.addresses, sombrero.proportions, {
            from: customer1
        });

        await web3tx(rToken.transfer, "rToken.transfer 10 customer1 -> customer2")(
            customer2, toWad(10), {
                from: customer1
            });

        tx = await web3tx(rToken.transfer, "rToken.transfer 10 customer1 -> customer2 again")(
            customer2, toWad(10), {
                from: customer1
            });
        console.debug("Same hat transfer tx cost", tx.receipt.gasUsed);
        assert.isTrue(tx.receipt.gasUsed < 300000, "Same hat optimization was not applied");

        // enlarge the sombrero
        sombrero.addresses.push("0x1000000000000000000000000000000000000000");
        sombrero.proportions.push(1);
        await expectRevert(web3tx(rToken.createHat, "rToken.createHat by bigger sombrero")(
            sombrero.addresses, sombrero.proportions, {
                from: admin
            }
        ), "Invalild hat: maximum number of recipients reached");

        // build a small sombrero
        await web3tx(token.transfer, "token.transfer 100 from customer 1 to customer 2")(
            customer3, toWad(100), {
                from: customer1
            }
        );
        await web3tx(token.approve, "token.approve 100 by customer3")(rToken.address, toWad(100), {
            from: customer3
        });
        await web3tx(rToken.mintWithNewHat, "rToken.mint 100 to customer3 with a smaller sombrero", {
            inLogs: [{
                name: "Transfer"
            }]
        })(toWad(100), sombrero.addresses.slice(1), sombrero.proportions.slice(1), {
            from: customer3
        });
    });

    it("#20 Change hat with invalid hat ID should fail", async () => {
        await expectRevert(rToken.changeHat(42), "Invalid hat ID");
    });

    it("#21 Hat should not have 0x0 recipient", async () => {
        await expectRevert(rToken.createHat(
            [ZERO_ADDRESS], [1], true, {
                from: customer1
            }
        ), "Invalid hat: recipient should not be 0x0");
    });

    it("#22 Change allocation strategy multiple times", async () => {
        let cToken2, compoundAS2, cToken3, compoundAS3;
        {
            // from 0.1 to 0.01
            const result = await createCompoundAllocationStrategy(toWad(.01));
            cToken2 = result.cToken;
            compoundAS2 = result.compoundAS;
        }
        {
            // from 0.01 to 10
            const result = await createCompoundAllocationStrategy(toWad(10));
            cToken3 = result.cToken;
            compoundAS3 = result.compoundAS;
        }
        await web3tx(compoundAS2.transferOwnership, "compoundAS2.transferOwnership")(rToken.address);
        await web3tx(compoundAS3.transferOwnership, "compoundAS3.transferOwnership")(rToken.address);

        await web3tx(token.approve, "token.approve 100 by customer1")(rToken.address, toWad(100), {
            from: customer1
        });
        await web3tx(rToken.mint, "rToken.mint 100 to customer1")(
            toWad(100), {
                from: customer1
            });
        assert.equal(wad4human(await token.balanceOf.call(customer1)), "900.00000");
        assert.equal(wad4human(await token.balanceOf.call(cToken.address)), "100.00000");
        assert.equal(wad4human(await cToken.balanceOf.call(compoundAS.address)), "1000.00000");
        assert.equal(wad4human(await rToken.balanceOf.call(customer1)), "100.00000");
        assert.equal(wad4human(await rToken.receivedSavingsOf.call(customer1)), "100.00000");

        await web3tx(rToken.changeAllocationStrategy,
            "change allocation strategy", {
                inLogs: [{
                    name: "AllocationStrategyChanged",
                    args: {
                        strategy: compoundAS2.address,
                        conversionRate: toWad(0.1)
                    }
                }]
            })(
            compoundAS2.address, {
                from: admin
            });
        assert.equal(wad4human(await token.balanceOf.call(cToken.address)), "0.00000");
        assert.equal(wad4human(await cToken.balanceOf.call(compoundAS.address)), "0.00000");
        assert.equal(wad4human(await token.balanceOf.call(cToken2.address)), "100.00000");
        assert.equal(wad4human(await cToken2.balanceOf.call(compoundAS2.address)), "10000.00000");
        assert.equal(wad4human(await token.balanceOf.call(customer1)), "900.00000");
        assert.equal(wad4human(await rToken.balanceOf.call(customer1)), "100.00000");
        assert.equal(wad4human(await rToken.receivedSavingsOf.call(customer1)), "100.00000");

        await web3tx(rToken.changeAllocationStrategy,
            "change allocation strategy", {
                inLogs: [{
                    name: "AllocationStrategyChanged",
                    args: {
                        strategy: compoundAS3.address,
                        conversionRate: toWad(100)
                    }
                }]
            })(
            compoundAS3.address, {
                from: admin
            });
        assert.equal(wad4human(await token.balanceOf.call(cToken2.address)), "0.00000");
        assert.equal(wad4human(await cToken2.balanceOf.call(compoundAS2.address)), "0.00000");
        assert.equal(wad4human(await token.balanceOf.call(cToken3.address)), "100.00000");
        assert.equal(wad4human(await cToken3.balanceOf.call(compoundAS3.address)), "10.00000");
        assert.equal(wad4human(await token.balanceOf.call(customer1)), "900.00000");
        assert.equal(wad4human(await rToken.balanceOf.call(customer1)), "100.00000");
        assert.equal(wad4human(await rToken.receivedSavingsOf.call(customer1)), "100.00000");

        await web3tx(rToken.redeem, "rToken.redeem 10 to customer1")(
            toWad(100), {
                from: customer1
            });
        assert.equal(wad4human(await token.balanceOf.call(cToken3.address)), "0.00000");
        assert.equal(wad4human(await cToken3.balanceOf.call(compoundAS3.address)), "0.00000");
        assert.equal(wad4human(await token.balanceOf.call(customer1)), "1000.00000");
        assert.equal(wad4human(await rToken.balanceOf.call(customer1)), "0.00000");
        assert.equal(wad4human(await rToken.receivedSavingsOf.call(customer1)), "0.00000");
    });
});
