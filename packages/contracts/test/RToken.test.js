const ERC20Mintable = artifacts.require("ERC20Mintable");
const CErc20 = artifacts.require("CErc20");
const ComptrollerMock = artifacts.require("ComptrollerMock");
const InterestRateModelMock = artifacts.require("InterestRateModelMock");
const CompoundAllocationStrategy = artifacts.require("CompoundAllocationStrategy");
const RToken = artifacts.require("RToken");
const Proxy = artifacts.require("Proxy");
const { time, expectRevert } = require("@openzeppelin/test-helpers");
const { web3tx, wad4human, toWad } = require("@decentral.ee/web3-test-helpers");

contract("RToken", accounts => {
    const MAX_UINT256 = "115792089237316195423570985008687907853269984665640564039457584007913129639935";
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

    function zeroHatUseCount(u) {
        return web3.utils.toBN(MAX_UINT256).sub(web3.utils.toBN(u)).toString();
    }

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

    function parseSavingAssetBalance({rAmount, sOriginalAmount}) {
        return {
            rAmount: wad4human(rAmount),
            sOriginalAmount: wad4human(sOriginalAmount)
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

        const receivedLoan = wad4human(await rToken.receivedLoanOf.call(account), decimals);
        console.log(`${accountName} receivedLoan ${receivedLoan} expected ${balances.receivedLoan}`);

        const receivedSavings = wad4human(await rToken.receivedSavingsOf.call(account), decimals);
        console.log(`${accountName} receivedSavings ${receivedSavings} expected ${balances.receivedSavings}`);

        const interestPayable = wad4human(await rToken.interestPayableOf.call(account), decimals);
        console.log(`${accountName} interestPayable ${interestPayable} expected ${balances.interestPayable}`);

        const accountStats = await rToken.getAccountStats.call(account);

        const cumulativeInterest = wad4human(accountStats.cumulativeInterest, decimals);
        console.log(`${accountName} cumulativeInterest ${cumulativeInterest} expected ${balances.cumulativeInterest}`);

        console.log(`${accountName} lDebt ${wad4human(accountStats.lDebt)}`);
        console.log(`${accountName} rInterest ${wad4human(accountStats.rInterest)}`);
        console.log(`${accountName} sInternalAmount ${wad4human(accountStats.sInternalAmount)}`);

        assert.equal(
            wad4human(
                web3.utils.toBN(accountStats.rAmount),
                12),
            wad4human(
                web3.utils.toBN(accountStats.lRecipientsSum)
                    .add(web3.utils.toBN(accountStats.rInterest)),
                12),
            "account invariant: rAmount = lRecipientsSum + rInterest");

        assert.deepEqual({
            tokenBalance,
            receivedLoan,
            receivedSavings,
            interestPayable,
            cumulativeInterest
        }, balances, `expectAccount ${accountName}`);
    }

    async function validateGlobalInvariants() {
        const accounts = [admin, customer1, customer2, customer3, customer4];
        let totalSupplyByAccounts = toWad(0);
        let totalSavingsAmountByAccounts = toWad(0);
        let totalReceivedLoansByAccounts = toWad(0);
        let totalDebtFreeInterestByAccounts = toWad(0);

        for (let i = 0; i < accounts.length; ++i) {
            const account = accounts[i];
            const stats = await rToken.getAccountStats.call(account);
            totalSupplyByAccounts = totalSupplyByAccounts
                .add(web3.utils.toBN(await rToken.balanceOf.call(account)));
            totalSavingsAmountByAccounts = totalSavingsAmountByAccounts
                .add(web3.utils.toBN(await rToken.receivedSavingsOf.call(account)));
            totalReceivedLoansByAccounts = totalReceivedLoansByAccounts
                .add(web3.utils.toBN(await rToken.receivedLoanOf.call(account)));
            totalDebtFreeInterestByAccounts = totalDebtFreeInterestByAccounts
                .add(web3.utils.toBN(stats.cumulativeInterest))
                .sub(web3.utils.toBN(stats.rInterest));
        }

        const globalStats = await rToken.getGlobalStats.call();
        assert.deepEqual({
            totalSupply: totalSupplyByAccounts.toString(),
            totalSavingsAmount: wad4human(totalSavingsAmountByAccounts, 12)
        }, {
            totalSupply: globalStats.totalSupply.toString(),
            totalSavingsAmount: wad4human(globalStats.totalSavingsAmount, 12)
        }, "invariants: accountStats vs globalStats");

        const nHats = parseInt((await rToken.getMaximumHatID.call()).toString()) + 1;
        let totalReceivedLoansByHats = toWad(0);
        let totalSavingsByHats = toWad(0);
        for (let i = 0; i <= nHats; ++i) {
            let hatID = i;
            if (i === nHats) hatID = SELF_HAT_ID;
            const stats = await rToken.getHatStats.call(hatID);
            totalReceivedLoansByHats = totalReceivedLoansByHats
                .add(web3.utils.toBN(stats.totalLoans));
            totalSavingsByHats = totalSavingsByHats
                .add(web3.utils.toBN(stats.totalSavings));
        }
        assert.deepEqual({
            totalReceivedLoans: totalReceivedLoansByAccounts.toString(),
            totalSavings: wad4human(totalSavingsAmountByAccounts.add(totalDebtFreeInterestByAccounts), 6),
        }, {
            totalReceivedLoans: totalReceivedLoansByHats.toString(),
            totalSavings: wad4human(totalSavingsByHats, 6),
        }, "invariants: accountStats vs hatStats");
    }

    it("#0 initial test condition", async () => {
        assert.equal(wad4human(await rToken.totalSupply.call()), "0.00000");
        assert.equal(wad4human(await cToken.balanceOf.call(customer1)), "0.00000");
        assert.equal(wad4human(await token.balanceOf.call(customer1)), "1000.00000");
    });

    it("#2 normal operations with zero hatter", async () => {
        // STEP 1: mint 100 -> customer1
        await web3tx(token.approve, "token.approve 100 by customer1")(rToken.address, toWad(100), {
            from: customer1
        });
        await expectRevert(rToken.mint(toWad(100.1), { from: customer1 }), "Not enough allowance");
        await web3tx(rToken.mint, "rToken.mint 100 to customer1", {
            inLogs: [{
                name: "Transfer",
                args: {
                    from: ZERO_ADDRESS,
                    to: customer1,
                    value: toWad(100)
                }
            }]
        })(toWad(100), { from: customer1 });
        assert.equal(wad4human(await token.balanceOf.call(customer1)), "900.00000");
        assert.equal(wad4human(await rToken.balanceOf.call(customer1)), "100.00000");
        await expectAccount(customer1, {
            tokenBalance: "100.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "100.00000",
            receivedSavings: "100.00000",
            interestPayable: "0.00000",
        });

        // STEP 2: binge borrowing
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
        await expectRevert(rToken.redeem("0", { from: customer1 }), "Redeem amount cannot be zero");

        // STEP 3: redeem 10 by customer1
        await web3tx(rToken.redeem, "rToken.redeem 10 by customer1", {
            inLogs: [{
                name: "Transfer",
                args: {
                    from: customer1,
                    to: ZERO_ADDRESS,
                    value: toWad(10)
                }
            }]
        })(toWad(10), { from: customer1 });
        assert.equal(wad4human(await token.balanceOf.call(customer1)), "910.00000");
        assert.equal(wad4human(await rToken.balanceOf.call(customer1)), "90.00102");
        await expectAccount(customer1, {
            tokenBalance: "90.00102",
            cumulativeInterest: "0.00102",
            receivedLoan: "90.00000",
            receivedSavings: "90.00102",
            interestPayable: "0.00000",
        });

        // STEP 5: payInterest to customer1
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
        assert.equal(wad4human(await rToken.balanceOf.call(customer1)), "90.00103");
        await expectAccount(customer1, {
            tokenBalance: "90.00103",
            cumulativeInterest: "0.00103",
            receivedLoan: "90.00000",
            receivedSavings: "90.00103",
            interestPayable: "0.00000",
        });
        await web3tx(rToken.payInterest, "rToken.payInterest to customer1 again", {
            inLogs: [{
                name: "InterestPaid"
            }]
        })(customer1, { from : admin });
        await expectAccount(customer1, {
            tokenBalance: "90.00104",
            cumulativeInterest: "0.00104",
            receivedLoan: "90.00000",
            receivedSavings: "90.00104",
            interestPayable: "0.00000",
        });
        assert.deepEqual(parseGlobalStats(await rToken.getGlobalStats.call()), {
            totalSupply: "90.00104",
            totalSavingsAmount: "90.00104"
        });

        // STEP 6: redeem 2 by customer1 and transfer to customer2
        await web3tx(rToken.redeemAndTransfer, "rToken.redeem 2 of customer1 to customer2", {
            inLogs: [{
                name: "Transfer",
                args: {
                    from: customer1,
                    to: ZERO_ADDRESS,
                    value: toWad(2)
                }
            }]
        })(customer2, toWad(2), { from: customer1 });
        assert.equal(wad4human(await token.balanceOf.call(customer2)), "2.00000");

        // STEP 7: transfer 10 from customer 1 to customer 3
        // some invalid tranfers
        await expectRevert(rToken.transfer(customer1, toWad(1), { from: customer1 }), "src should not equal dst");
        await expectRevert(rToken.transfer(customer2, toWad(100.1), { from: customer1 }), "Not enough balance to transfer");
        await expectRevert(rToken.transferFrom(customer1, customer2, toWad(1), { from: admin }), "Not enough allowance for transfer");
        await web3tx(rToken.transfer, "rToken.transfer 10 from customer1 to customer3", {
            inLogs: [{
                name: "Transfer",
                args: {
                    from: customer1,
                    to: customer3,
                    value: toWad(10)
                }
            }]
        })(customer3, toWad(10), { from: customer1 });
        await expectAccount(customer1, {
            tokenBalance: "78.00109",
            cumulativeInterest: "0.00109",
            receivedLoan: "78.00000",
            receivedSavings: "78.00109",
            interestPayable: "0.00000",
        });
        await expectAccount(customer3, {
            tokenBalance: "10.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "10.00000",
            receivedSavings: "10.00000",
            interestPayable: "0.00000",
        });

        // STEP 7: transfer 5 from customer 3 to customer 1
        await web3tx(rToken.transfer, "rToken.transfer 5 from customer3 to customer1", {
            inLogs: [{
                name: "Transfer",
                args: {
                    from: customer3,
                    to: customer1,
                    value: toWad(5)
                }
            }]
        })(customer1, toWad(5), { from: customer3 });
        await expectAccount(customer1, {
            tokenBalance: "83.00110",
            cumulativeInterest: "0.00110",
            receivedLoan: "83.00000",
            receivedSavings: "83.00110",
            interestPayable: "0.00000",
        });
        await expectAccount(customer3, {
            tokenBalance: "5.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "5.00000",
            receivedSavings: "5.00000",
            interestPayable: "0.00000",
        });

        // Validate global stats
        await validateGlobalInvariants();
        assert.deepEqual(parseGlobalStats(await rToken.getGlobalStats.call()), {
            totalSupply: "88.00110",
            totalSavingsAmount: "88.00110"
        });
        assert.deepEqual(parseHatStats(await rToken.getHatStats(0)), {
            useCount: zeroHatUseCount(0),
            totalLoans: "88.00000",
            totalSavings: "88.00110",
        });
    });

    it("#3 normal operations with hat", async () => {
        // STEP 1: mint 100 to customer1
        await web3tx(token.approve, "token.approve 100 by customer1")(
            rToken.address, toWad(100), { from: customer1 });
        await web3tx(rToken.mintWithNewHat, "rToken.mint 100 to customer1 with a hat benefiting admin(90%) and customer2(10%)")(
            toWad(100), [admin, customer2], [90, 10], { from: customer1 });
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

        // STEP 2: binge borrowing
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

        // STEP 3: redeem 10 to customer1
        await web3tx(rToken.redeem, "rToken.redeem 10 to customer1")(
            toWad(10), { from: customer1 });
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

        // STEP 4: transfer 10 from customer1 to customer3
        await web3tx(rToken.transfer, "rToken.transfer 10 customer1 -> customer3")(
            customer3, toWad(10), { from: customer1 });
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

        // STEP 5: pay interest to admin
        assert.equal(wad4human(await rToken.balanceOf(admin)), "0.00000");
        await web3tx(rToken.payInterest, "rToken.payInterest to admin")(
            admin, { from : admin });
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

        // STEP 6: wait for the interest
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

        // STEP 7: transfer 5 from customer3 to customer1
        await web3tx(rToken.transfer, "rToken.transfer 10 customer3 -> customer1")(
            customer1, toWad(5), { from: customer3 });
        await expectAccount(customer1, {
            tokenBalance: "85.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "0.00000",
            receivedSavings: "0.00000",
            interestPayable: "0.00000",
        });
        await expectAccount(admin, {
            tokenBalance: "0.00093",
            cumulativeInterest: "0.00093",
            receivedLoan: "81.00000",
            receivedSavings: "81.00184",
            interestPayable: "0.00091",
        });
        await expectAccount(customer2, {
            tokenBalance: "0.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "9.00000",
            receivedSavings: "9.00020",
            interestPayable: "0.00020",
        });
        await expectAccount(customer3, {
            tokenBalance: "5.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "0.00000",
            receivedSavings: "0.00000",
            interestPayable: "0.00000",
        });

        // STEP 8: transfer 20 from customer1 to customer2
        await web3tx(rToken.transfer, "rToken.transfer 10 customer1 -> customer2")(
            customer2, toWad(20), { from: customer1 });
        await expectAccount(customer1, {
            tokenBalance: "65.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "0.00000",
            receivedSavings: "0.00000",
            interestPayable: "0.00000",
        });
        await expectAccount(admin, {
            tokenBalance: "0.00093",
            cumulativeInterest: "0.00093",
            receivedLoan: "81.00000",
            receivedSavings: "81.00185",
            interestPayable: "0.00092",
        });
        await expectAccount(customer2, {
            tokenBalance: "20.00021",
            cumulativeInterest: "0.00021",
            receivedLoan: "9.00000",
            receivedSavings: "9.00021",
            interestPayable: "0.00000",
        });
        await expectAccount(customer3, {
            tokenBalance: "5.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "0.00000",
            receivedSavings: "0.00000",
            interestPayable: "0.00000",
        });

        // STEP 8: transfer all from customer2 to customer1
        await web3tx(rToken.transferAll, "rToken.transferAll customer2 -> customer1")(
            customer1, { from: customer2 });
        await expectAccount(customer1, {
            tokenBalance: "85.00021",
            cumulativeInterest: "0.00000",
            receivedLoan: "0.00000",
            receivedSavings: "0.00000",
            interestPayable: "0.00000",
        });
        await expectAccount(admin, {
            tokenBalance: "0.00093",
            cumulativeInterest: "0.00093",
            receivedLoan: "81.00019",
            receivedSavings: "81.00204",
            interestPayable: "0.00093",
        });
        await expectAccount(customer2, {
            tokenBalance: "0.00000",
            cumulativeInterest: "0.00021",
            receivedLoan: "9.00002",
            receivedSavings: "9.00002",
            interestPayable: "0.00000",
        });
        await expectAccount(customer3, {
            tokenBalance: "5.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "0.00000",
            receivedSavings: "0.00000",
            interestPayable: "0.00000",
        });

        // Validate global stats
        await validateGlobalInvariants();
        assert.deepEqual(parseGlobalStats(await rToken.getGlobalStats.call()), {
            totalSupply: "90.00113",
            totalSavingsAmount: "90.00206"
        });
        assert.deepEqual(parseHatStats(await rToken.getHatStats(0)), {
            useCount: zeroHatUseCount(3),
            totalLoans: "0.00000",
            totalSavings: "0.00000",
        });
        assert.deepEqual(parseHatStats(await rToken.getHatStats(1)), {
            useCount: "3",
            totalLoans: "90.00021",
            totalSavings: "90.00227",
        });
    });

    it("#4 mint multiple times", async () => {
        await web3tx(token.approve, "token.approve 100 by customer1")(
            rToken.address, toWad(100), { from: customer1 });
        await web3tx(rToken.mint, "rToken.mint 10 to customer1")(
            toWad(10), { from: customer1 });
        await expectAccount(customer1, {
            tokenBalance: "10.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "10.00000",
            receivedSavings: "10.00000",
            interestPayable: "0.00000",
        });

        await web3tx(rToken.mint, "rToken.mint 5 to customer1")(
            toWad(5), { from: customer1 });
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

        await validateGlobalInvariants();
    });

    it("#5 redeem all including paid interest from single hat", async () => {
        // STEP 1: mint 200 -> customer1 with hat[customer1:10%, customer2:90%]
        await web3tx(token.approve, "token.approve 100 by customer1")(
            rToken.address, toWad(200), { from: customer1 });
        await web3tx(rToken.mintWithNewHat, "rToken.mint 200 to customer1 with a hat benefiting customer1(10%) and customer2(90%)")(
            toWad(200), [customer1, customer2], [10, 90], { from: customer1 });

        // STEP 2: transfer 100 customer1 -> customer2
        await web3tx(rToken.transfer, "rToken.transfer 100 customer1 -> customer2")(
            customer2, toWad(100), { from: customer1 });
        assert.equal(wad4human(await rToken.totalSupply.call()), "200.00000");
        assert.equal(wad4human(await token.balanceOf.call(customer1)), "800.00000");
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

        // STEP 2: binge borrowing
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

        // STEP 3: pay interest to customer2
        await web3tx(rToken.payInterest, "rToken.payInterest to customer2")(
            customer2, { from : admin });
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

        // STEP 4: redeem 100.00091 for customer2
        const customer2RBalance = toWad("100.00091");
        await expectRevert(rToken.redeem(customer2RBalance.add(toWad("0.00001")), { from: customer2 }), "Not enough balance to redeem");
        await web3tx(rToken.redeem, "rToken.redeem 100.00091 for customer2")(
            customer2RBalance, { from: customer2 });
        assert.isTrue((await token.balanceOf.call(customer2)).eq(customer2RBalance));
        await expectAccount(customer1, {
            tokenBalance: "100.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "10.00000",
            receivedSavings: "10.00010",
            interestPayable: "0.00010",
        });
        await expectAccount(customer2, {
            tokenBalance: "0.00002",
            cumulativeInterest: "0.00093",
            receivedLoan: "90.00000",
            receivedSavings: "90.00002",
            interestPayable: "0.00000",
        });

        // Validate global stats
        await validateGlobalInvariants();
        assert.deepEqual(parseGlobalStats(await rToken.getGlobalStats.call()), {
            totalSupply: "100.00002",
            totalSavingsAmount: "100.00012"
        });
        assert.deepEqual(parseHatStats(await rToken.getHatStats(0)), {
            useCount: zeroHatUseCount(2),
            totalLoans: "0.00000",
            totalSavings: "0.00000",
        });
        assert.deepEqual(parseHatStats(await rToken.getHatStats(1)), {
            useCount: "2",
            totalLoans: "100.00000",
            totalSavings: "100.00103",
        });
    });

    it("#6 transfer and switch hats", async () => {
        await web3tx(rToken.createHat, "rToken.createHat for customer1 benefiting admin and customer3 10/90")(
            [admin, customer3], [10, 90], true, { from: customer1 }
        );
        assert.deepEqual(parseHat(await rToken.getHatByAddress.call(customer1)), {
            hatID: 1,
            recipients: [admin, customer3],
            proportions: [429496729, 3865470565]
        });

        await web3tx(rToken.createHat, "rToken.createHat for customer2 benefiting admin and customer4 20/80")(
            [admin, customer4], [20, 80], true, { from: customer2 }
        );
        await web3tx(rToken.createHat, "rToken.createHat but not using it")(
            [admin, customer4], [50, 50], false, { from: customer2 }
        );
        assert.deepEqual(parseHat(await rToken.getHatByAddress.call(customer2)), {
            hatID: 2,
            recipients: [admin, customer4],
            proportions: [858993459, 3435973836]
        });
        assert.deepEqual(parseHat(await rToken.getHatByID.call(3)), {
            recipients: [admin, customer4],
            proportions: [2147483647, 2147483647]
        });

        await web3tx(token.approve, "token.approve 100 by customer1")(rToken.address, toWad(200), {
            from: customer1
        });
        await web3tx(rToken.mint, "rToken.mint 100 to customer1")(
            toWad(200), { from: customer1 });
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
            customer2, toWad(100), { from: customer1 });
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

        await validateGlobalInvariants();
    });

    it("#7 redeem all including paid interest from zero hatter", async () => {
        // STEP 1: mint 100 -> customer2 as reserve
        await web3tx(token.transfer, "token.transfer 100 from customer 1 to customer 2")(
            customer2, toWad(100), { from: customer1 }
        );
        await web3tx(token.approve, "token.approve 100 by customer2")(rToken.address, toWad(100), {
            from: customer2
        });
        await web3tx(rToken.mint, "rToken.mint 100 to customer2")(toWad(100), {
            from: customer2
        });
        await expectAccount(customer2, {
            tokenBalance: "100.00000",
            receivedLoan: "100.00000",
            receivedSavings: "100.00000",
            interestPayable: "0.00000",
            cumulativeInterest: "0.00000",
        });

        // STEP 2: mint 100 -> customer1
        await web3tx(token.approve, "token.approve 100 by customer1")(rToken.address, toWad(100), {
            from: customer1
        });
        await web3tx(rToken.mint, "rToken.mint 100 to customer1")(toWad(100), {
            from: customer1
        });
        await expectAccount(customer1, {
            tokenBalance: "100.00000",
            receivedLoan: "100.00000",
            receivedSavings: "100.00000",
            interestPayable: "0.00000",
            cumulativeInterest: "0.00000",
        });

        // STEP 3: binge borrowing
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
        await expectAccount(customer2, {
            tokenBalance: "100.00000",
            receivedLoan: "100.00000",
            receivedSavings: "100.00051",
            interestPayable: "0.00051",
            cumulativeInterest: "0.00000",
        });

        // STEP 4: redeem all for customer1
        await web3tx(rToken.redeemAll, "rToken.redeem all for customer1")(
            { from: customer1 });
        assert.equal(wad4human(await token.balanceOf.call(customer1)), "900.00051");
        await expectAccount(customer1, {
            tokenBalance: "0.00000",
            receivedLoan: "0.00000",
            receivedSavings: "0.00000", // savings that keeps accumulating
            interestPayable: "0.00000",
            cumulativeInterest: "0.00051",
        });

        // STEP 5: mint again 100 -> customer1
        await web3tx(token.approve, "token.approve 100 by customer1")(rToken.address, toWad(100), {
            from: customer1
        });
        await web3tx(rToken.mint, "rToken.mint 100 to customer1")(toWad(100), {
            from: customer1
        });
        await expectAccount(customer1, {
            tokenBalance: "100.00000",
            receivedLoan: "100.00000",
            receivedSavings: "100.00000",
            interestPayable: "0.00000",
            cumulativeInterest: "0.00051",
        });

        // STEP 6: wait for interest
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

        // STEP 7: transfer all customer1 -> customer2
        await web3tx(rToken.transferAll, "rToken.transfer all from customer1 to customer2")(
            customer2, { from: customer1 });
        await expectAccount(customer1, {
            tokenBalance: "0.00000",
            receivedLoan: "0.00000",
            receivedSavings: "0.00000",
            interestPayable: "0.00000",
            cumulativeInterest: "0.00102",
        });
        await expectAccount(customer2, {
            tokenBalance: "200.00155",
            receivedLoan: "200.00051",
            receivedSavings: "200.00155",
            interestPayable: "0.00000",
            cumulativeInterest: "0.00104",
        });

        // STEP 8: mint again 100 -> customer1
        await web3tx(token.approve, "token.approve 100 by customer1")(
            rToken.address, toWad(100), { from: customer1 });
        await web3tx(rToken.mint, "rToken.mint 100 to customer1")(toWad(100), {
            from: customer1
        });
        await expectAccount(customer1, {
            tokenBalance: "100.00000",
            receivedLoan: "100.00000",
            receivedSavings: "100.00000",
            interestPayable: "0.00000",
            cumulativeInterest: "0.00102",
        });

        // STEP 9: wait for interest
        await waitForInterest();
        await web3tx(rToken.payInterest, "rToken.payInterest to customer1")(
            customer1, { from : admin });
        await expectAccount(customer1, {
            tokenBalance: "100.00034",
            receivedLoan: "100.00000",
            receivedSavings: "100.00034",
            interestPayable: "0.00000",
            cumulativeInterest: "0.00136",
        });
        await expectAccount(customer2, {
            tokenBalance: "200.00155",
            receivedLoan: "200.00051",
            receivedSavings: "200.00224",
            interestPayable: "0.00069",
            cumulativeInterest: "0.00104",
        });

        // Validate global stats
        await validateGlobalInvariants();
        assert.deepEqual(parseGlobalStats(await rToken.getGlobalStats.call()), {
            totalSupply: "300.00189",
            totalSavingsAmount: "300.00258"
        });
        assert.deepEqual(parseHatStats(await rToken.getHatStats(0)), {
            useCount: zeroHatUseCount(0),
            totalLoans: "300.00051",
            totalSavings: "300.00360",
        });
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

    it("#9 normal operations with self hatter", async () => {
        await web3tx(token.approve, "token.approve 100 by customer1")(
            rToken.address, toWad(100), { from: customer1 });
        await expectRevert(rToken.mintWithSelectedHat(toWad(1), 1), "Invalid hat ID");
        await web3tx(rToken.mintWithSelectedHat, "rToken.mintWithSelectedHat 100 to customer1 with the self hat")(
            toWad(100), await rToken.SELF_HAT_ID.call(), { from: customer1 });
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
            customer2, toWad(20), { from: customer1 });
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
            SELF_HAT_ID, { from: customer3 }
        );
        await web3tx(rToken.transfer, "rToken.transfer all from customer1 to customer3")(
            customer3, toWad(20), { from: customer1 });
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

        await validateGlobalInvariants();
    });

    it("#10 CompoundAs ownership protection", async () => {
        await web3tx(token.approve, "token.approve 100 by customer1")(
            rToken.address, toWad(100), { from: customer1 });
        await web3tx(rToken.mintWithSelectedHat, "rToken.mintWithSelectedHat 100 to customer1 with the self hat")(
            toWad(100), await rToken.SELF_HAT_ID.call(), { from: customer1 });
        await expectRevert(web3tx(compoundAS.redeemUnderlying, "redeemUnderlying by admin")(
            toWad(100), { from: admin }
        ), "Ownable: caller is not the owner");
    });

    it("#11 transferAll", async () => {
        await web3tx(token.approve, "token.approve 100 by customer1")(
            rToken.address, toWad(100), { from: customer1 });
        await web3tx(rToken.mintWithSelectedHat, "rToken.mintWithSelectedHat 100 to customer1 with the self hat")(
            toWad(100), await rToken.SELF_HAT_ID.call(), { from: customer1 });

        await doBingeBorrowing();

        await web3tx(rToken.transferAll, "rToken.transferAll from customer1 to customer2")(
            customer2, { from: customer1 });
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

        await validateGlobalInvariants();
    });

    it("#12 redeem all including paid interest from multiple hats", async () => {
        // STEP 1: mint 100 -> customer1 with self-hat
        await web3tx(token.approve, "token.approve 100 by customer1")(
            rToken.address, toWad(100), { from: customer1 });
        await web3tx(rToken.mintWithSelectedHat, "rToken.mintWithSelectedHat 100 to customer1 with the self hat")(
            toWad(100), await rToken.SELF_HAT_ID.call(), { from: customer1 });

        // STEP 2: transfer 100 customer1 -> customer2
        await web3tx(token.transfer, "token.transfer 100 from customer 1 to customer 2")(
            customer2, toWad(100), { from: customer1 }
        );
        await web3tx(token.transfer, "token.transfer 100 from customer 1 to customer 3")(
            customer3, toWad(100), { from: customer1 }
        );

        // STEP 3: mint 100 -> customer2 with hat [customer1:100%]
        //         mint 100 -> customer3 as reserve
        await web3tx(token.approve, "token.approve 100 by customer2")(
            rToken.address, toWad(100), { from: customer2 });
        await web3tx(rToken.mintWithNewHat, "rToken.mintWithSelectedHat 100 to customer2 with customer1 as recipient")(
            toWad(100), [customer1], [100], { from: customer2 });
        await web3tx(token.approve, "token.approve 100 by customer3")(
            rToken.address, toWad(100), { from: customer3 });
        await web3tx(rToken.mint, "rToken.mint 100 to customer3 with zero hat")(
            toWad(100), { from: customer3 });

        // STEP 4: binge borrowing
        await doBingeBorrowing();
        await expectAccount(customer1, {
            tokenBalance: "100.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "200.00000",
            receivedSavings: "200.00067",
            interestPayable: "0.00067",
        });
        await expectAccount(customer2, {
            tokenBalance: "100.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "0.00000",
            receivedSavings: "0.00000",
            interestPayable: "0.00000",
        });
        assert.deepEqual(parseHatStats(await rToken.getHatStats(1)), {
            useCount: "1",
            totalLoans: "100.00000",
            totalSavings: "100.00033",
        });
        assert.deepEqual(parseHatStats(await rToken.getHatStats(SELF_HAT_ID)), {
            useCount: "1",
            totalLoans: "100.00000",
            totalSavings: "100.00033",
        });

        // STEP 4: redeem 50 for customer2
        await web3tx(rToken.redeem, "rToken.redeem 50 for customer2", {
            inLogs: [{
                name: "Transfer",
                args: {
                    from: customer2,
                    to: ZERO_ADDRESS,
                }
            }]
        })(toWad(50), { from: customer2 });
        await expectAccount(customer1, {
            tokenBalance: "100.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "150.00000",
            receivedSavings: "150.00067",
            interestPayable: "0.00067",
        });
        await expectAccount(customer2, {
            tokenBalance: "50.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "0.00000",
            receivedSavings: "0.00000",
            interestPayable: "0.00000",
        });
        assert.deepEqual(parseHatStats(await rToken.getHatStats(1)), {
            useCount: "1",
            totalLoans: "50.00000",
            totalSavings: "50.00034",
        });
        assert.deepEqual(parseHatStats(await rToken.getHatStats(SELF_HAT_ID)), {
            useCount: "1",
            totalLoans: "100.00000",
            totalSavings: "100.00034",
        });

        // STEP 5: redeemAll for customer1
        await web3tx(rToken.redeemAll, "rToken.redeemAll for customer1", {
            inLogs: [{
                name: "InterestPaid",
                args: {
                    recipient: customer1,
                }
            }, {
                name: "Transfer",
                args: {
                    from: customer1,
                    to: ZERO_ADDRESS,
                }
            }]
        })({ from: customer1 });
        assert.equal(wad4human(await token.balanceOf.call(customer1)), "800.00068");
        await expectAccount(customer1, {
            tokenBalance: "0.00000",
            cumulativeInterest: "0.00068",
            receivedLoan: "50.00000",
            receivedSavings: "50.00000",
            interestPayable: "0.00000",
        });
        await expectAccount(customer2, {
            tokenBalance: "50.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "0.00000",
            receivedSavings: "0.00000",
            interestPayable: "0.00000",
        });
        assert.deepEqual(parseHatStats(await rToken.getHatStats(1)), {
            useCount: "1",
            totalLoans: "50.00000",
            totalSavings: "50.00034",
        });
        assert.deepEqual(parseHatStats(await rToken.getHatStats(SELF_HAT_ID)), {
            useCount: "1",
            totalLoans: "0.00000",
            totalSavings: "0.00034",
        });

        // STEP 6: redeemAll for customer2
        await web3tx(rToken.redeemAll, "rToken.redeemAll for customer2")(
            { from: customer2 });
        await expectAccount(customer1, {
            tokenBalance: "0.00000",
            cumulativeInterest: "0.00068",
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
            tokenBalance: "100.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "100.00000",
            receivedSavings: "100.00035",
            interestPayable: "0.00035",
        });

        // Validate global stats
        await validateGlobalInvariants();
        assert.deepEqual(parseGlobalStats(await rToken.getGlobalStats.call()), {
            totalSupply: "100.00000",
            totalSavingsAmount: "100.00035"
        });
        assert.deepEqual(parseHatStats(await rToken.getHatStats(0)), {
            useCount: zeroHatUseCount(2),
            totalLoans: "100.00000",
            totalSavings: "100.00035",
        });
        assert.deepEqual(parseHatStats(await rToken.getHatStats(1)), {
            useCount: "1",
            totalLoans: "0.00000",
            totalSavings: "0.00034",
        });
        assert.deepEqual(parseHatStats(await rToken.getHatStats(SELF_HAT_ID)), {
            useCount: "1",
            totalLoans: "0.00000",
            totalSavings: "0.00034",
        });
    });

    it("#13 approve & transferFrom & transferAllFrom", async () => {
        await web3tx(token.approve, "token.approve 100 by customer1")(rToken.address, toWad(100), {
            from: customer1
        });
        await web3tx(rToken.mintWithSelectedHat, "rToken.mintWithSelectedHat 100 to customer1 with the self hat")(
            toWad(100), await rToken.SELF_HAT_ID.call(), { from: customer1 });
        await web3tx(rToken.approve, "token.approve customer 2 by customer1")(
            customer2, toWad(50), { from: customer1 });
        assert.isTrue((await rToken.allowance.call(customer1, customer2)).eq(toWad(50)));
        await expectRevert(web3tx(rToken.transferFrom, "rToken transferFrom customer1 -> customer3 by customer2 more than approved")(
            customer1, customer3, toWad(50).add(web3.utils.toBN(1)),
            { from: customer2 }
        ), "Not enough allowance for transfer");
        await web3tx(rToken.transferFrom, "rToken transferFrom customer1 -> customer3 by customer2 all approved")(
            customer1, customer3, toWad(50), { from: customer2 });
        assert.isTrue((await rToken.allowance.call(customer1, customer2)).eq(toWad(0)));
        await web3tx(rToken.approve, "token.approve customer 2 by customer1")(
            customer2, toWad(10000), { from: customer1 });

        await doBingeBorrowing();

        await web3tx(rToken.transferAllFrom, "rToken transferAllFrom customer1 -> customer3 by customer2")(
            customer1, customer3, { from: customer2 });
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

        await validateGlobalInvariants();
    });

    it("#14 redeemAndTransferAll", async () => {
        await web3tx(token.approve, "token.approve 100 by customer1")(
            rToken.address, toWad(100), { from: customer1 });
        await web3tx(rToken.mintWithSelectedHat, "rToken.mintWithSelectedHat 100 to customer1 with the self hat")(
            toWad(100), await rToken.SELF_HAT_ID.call(), { from: customer1 });

        await web3tx(token.transfer, "token.transfer 100 from customer 1 to customer 2")(
            customer2, toWad(100), { from: customer1 });
        await web3tx(token.approve, "token.approve 100 by customer2")(
            rToken.address, toWad(100), { from: customer2 });
        await web3tx(rToken.mintWithSelectedHat, "rToken.mintWithSelectedHat 100 to customer2 with the self hat")(
            toWad(100), await rToken.SELF_HAT_ID.call(), { from: customer2 });

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

        await validateGlobalInvariants();
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
        // admin
        assert.equal(await rToken.owner.call(), admin);
        await expectRevert(rToken.transferOwnership(customer1, { from: customer1 }), "Ownable: caller is not the owner");
        await web3tx(rToken.transferOwnership, "change owner to customer1")(customer1, { from: admin });
        assert.equal(await rToken.owner.call(), customer1);
        await expectRevert(rToken.transferOwnership(customer1, { from: admin }), "Ownable: caller is not the owner");
        await web3tx(rToken.transferOwnership, "change owner to admin")(admin, { from: customer1 });

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
        await web3tx(rTokenLogic.renounceOwnership, "rTokenLogic renounceOwnership")({ from: admin });
        await expectRevert(rTokenLogic.transferOwnership(customer1, { from: admin }), "Ownable: caller is not the owner");

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
        await web3tx(rToken.mintWithNewHat, "rToken.mint 100 to customer1 with a hat benefiting admin(90%) and customer2(10%)")(
            toWad(100), [admin, customer2], [90, 10], { from: customer1 });

        assert.deepEqual(parseHatStats(await rToken.getHatStats(1)), {
            useCount: "1",
            totalLoans: "100.00000",
            totalSavings: "100.00000",
        });

        await expectRevert(web3tx(rToken.changeHatFor, "rToken.changeHatFor by customer1")(
            cToken.address, 1, { from: customer1 }
        ), "Ownable: caller is not the owner");
        await web3tx(rToken.changeHatFor, "rToken.changeHatFor by customer1")(
            cToken.address, 1, { from: admin }
        );
        assert.deepEqual(parseHatStats(await rToken.getHatStats(1)), {
            useCount: "2",
            totalLoans: "100.00000",
            totalSavings: "100.00000",
        });

        await expectRevert(web3tx(rToken.changeHatFor, "rToken.changeHatFor by customer1")(
            customer3, 1, { from: admin }
        ), "Admin can only change hat for contract address");
    });

    it("#19 Max hat numbers & same hat optimization", async () => {
        let tx;

        await web3tx(token.approve, "token.approve 100 by customer1")(
            rToken.address, toWad(100), { from: customer1 });

        // build a sombrero
        const sombrero = { addresses: [], proportions: []};
        for (let i = 1; i <= 50; ++i) {
            sombrero.addresses.push(`0x${i}00fdf4076b8f3a5357c5e395ab970b5b54098fef`.substr(0, 42));
            sombrero.proportions.push(1);
        }

        await web3tx(rToken.mintWithNewHat, "rToken.mint 100 to customer1 with a sombreror")(
            toWad(100), sombrero.addresses, sombrero.proportions,
            { from: customer1 });
        await expectAccount(customer1, {
            tokenBalance: "100.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "0.00000",
            receivedSavings: "0.00000",
            interestPayable: "0.00000"
        });
        for (let i = 1; i <= sombrero.length; ++i) {
            await expectAccount(sombrero.addresses[i], {
                tokenBalance: "0.00000",
                cumulativeInterest: "0.00000",
                receivedLoan: "2.00000",
                receivedSavings: "2.00000",
                interestPayable: "0.00000"
            });
        }

        tx = await web3tx(rToken.transfer, "rToken.transfer 10 customer1 -> customer2")(
            customer2, toWad(10), {
                from: customer1
            });
        console.debug("normal transfer tx cost", tx.receipt.gasUsed);
        await expectAccount(customer1, {
            tokenBalance: "90.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "0.00000",
            receivedSavings: "0.00000",
            interestPayable: "0.00000"
        });
        await expectAccount(customer2, {
            tokenBalance: "10.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "0.00000",
            receivedSavings: "0.00000",
            interestPayable: "0.00000"
        });
        for (let i = 1; i <= sombrero.length; ++i) {
            await expectAccount(sombrero.addresses[i], {
                tokenBalance: "0.00000",
                cumulativeInterest: "0.00000",
                receivedLoan: "2.00000",
                receivedSavings: "2.00000",
                interestPayable: "0.00000"
            });
        }

        tx = await web3tx(rToken.transfer, "rToken.transfer 10 customer1 -> customer2 again")(
            customer2, toWad(10), { from: customer1 });
        console.debug("Same hat transfer tx cost", tx.receipt.gasUsed);
        // temporarily disable same hat optimization
        //assert.isTrue(tx.receipt.gasUsed < 300000, "Same hat optimization was not applied");
        for (let i = 1; i <= sombrero.length; ++i) {
            await expectAccount(sombrero.addresses[i], {
                tokenBalance: "0.00000",
                cumulativeInterest: "0.00000",
                receivedLoan: "2.00000",
                receivedSavings: "2.00000",
                interestPayable: "0.00000"
            });
        }

        // enlarge the sombrero
        sombrero.addresses.push("0x1000000000000000000000000000000000000000");
        sombrero.proportions.push(1);
        await expectRevert(web3tx(rToken.createHat, "rToken.createHat by bigger sombrero")(
            sombrero.addresses, sombrero.proportions, { from: admin }
        ), "Invalild hat: maximum number of recipients reached");

        // build a small sombrero
        await web3tx(token.transfer, "token.transfer 100 from customer 1 to customer 2")(
            customer3, toWad(100), { from: customer1 });
        await web3tx(token.approve, "token.approve 100 by customer3")(rToken.address, toWad(100), {
            from: customer3
        });
        await web3tx(rToken.mintWithNewHat, "rToken.mint 100 to customer3 with a smaller sombrero")(
            toWad(100), sombrero.addresses.slice(1), sombrero.proportions.slice(1),
            { from: customer3 });

        // Validate global stats
        assert.deepEqual(parseGlobalStats(await rToken.getGlobalStats.call()), {
            totalSupply: "200.00000",
            totalSavingsAmount: "200.00000"
        });
        assert.deepEqual(parseHatStats(await rToken.getHatStats(0)), {
            useCount: zeroHatUseCount(3),
            totalLoans: "0.00000",
            totalSavings: "0.00000",
        });
        assert.deepEqual(parseHatStats(await rToken.getHatStats(1)), {
            useCount: "2",
            totalLoans: "100.00000",
            totalSavings: "100.00000",
        });
        assert.deepEqual(parseHatStats(await rToken.getHatStats(2)), {
            useCount: "1",
            totalLoans: "100.00000",
            totalSavings: "100.00000",
        });
    });

    it("#20 change hat with invalid hat ID should fail", async () => {
        await expectRevert(rToken.changeHat(42), "Invalid hat ID");
    });

    it("#21 create invalid hats", async () => {
        await expectRevert(rToken.createHat(
            [], [], true, {
                from: customer1
            }

        ), "Invalid hat: at least one recipient");
        await expectRevert(rToken.createHat(
            [customer1], [10, 20], true, {
                from: customer1
            }

        ), "Invalid hat: length not matching");
        await expectRevert(rToken.createHat(
            [ZERO_ADDRESS], [1], true, {
                from: customer1
            }
        ), "Invalid hat: recipient should not be 0x0");
        await expectRevert(rToken.createHat(
            [customer1], [0], true, {
                from: customer1
            }

        ), "Invalid hat: proportion should be larger than 0");
    });

    it("#22 change allocation strategy multiple times", async () => {
        let cToken2, compoundAS2, cToken3, compoundAS3;
        {
        // from 0.1 (AS1) to 0.01 (AS2)
            const result = await createCompoundAllocationStrategy(toWad(".01"));
            cToken2 = result.cToken;
            compoundAS2 = result.compoundAS;
        }
        {
        // from 0.01 (AS2) to 10 (AS3)
            const result = await createCompoundAllocationStrategy(toWad("10"));
            cToken3 = result.cToken;
            compoundAS3 = result.compoundAS;
        }
        await web3tx(compoundAS2.transferOwnership, "compoundAS2.transferOwnership")(rToken.address);
        await web3tx(compoundAS3.transferOwnership, "compoundAS3.transferOwnership")(rToken.address);

        // create some reserve in the cToken pool for lending
        await web3tx(token.transfer, "token.transfer 100 from customer 1 to customer 2")(
            customer2, toWad(100), {
                from: customer1
            }
        );
        await web3tx(token.approve, "token.approve 100 by customer2")(cToken.address, toWad(100), {
            from: customer2
        });
        await web3tx(cToken.mint, "cToken.mint 100 to customer2")(toWad(100), {
            from: customer2
        });
        assert.equal(wad4human(await token.balanceOf.call(customer1)), "900.00000");
        assert.equal(wad4human(await token.balanceOf.call(cToken.address)), "100.00000");
        assert.equal(wad4human(await cToken.balanceOfUnderlying.call(compoundAS.address)), "0.00000");
        assert.equal(wad4human(await cToken.balanceOfUnderlying.call(customer2)), "100.00000");
        assert.equal(toWad(0)
            .add(await token.balanceOf.call(customer1))
            .add(await token.balanceOf.call(cToken.address))
            .toString(), toWad(1000));
        assert.equal(wad4human(await rToken.balanceOf.call(customer1)), "0.00000");

        // mint 100 rToken
        await web3tx(token.approve, "token.approve 100 by customer1")(rToken.address, toWad(100), {
            from: customer1
        });
        await web3tx(rToken.mint, "rToken.mint 100 to customer1")(
            toWad("100"), {
                from: customer1
            });
        assert.equal(wad4human(await token.balanceOf.call(customer1)), "800.00000");
        assert.equal(wad4human(await token.balanceOf.call(cToken.address)), "200.00000");
        assert.equal(wad4human(await cToken.balanceOfUnderlying.call(compoundAS.address)), "100.00000");
        assert.equal(wad4human(await cToken.balanceOfUnderlying.call(customer2)), "100.00000");
        assert.equal(toWad(0)
            .add(await token.balanceOf.call(customer1))
            .add(await token.balanceOf.call(cToken.address))
            .toString(), toWad(1000));
        assert.equal(wad4human(await rToken.balanceOf.call(customer1)), "100.00000");
        assert.equal(wad4human(await rToken.receivedSavingsOf.call(customer1)), "100.00000");

        await doBingeBorrowing();

        // trivial case: transfer the the same allocation strategy
        assert.equal((await rToken.savingAssetConversionRate.call()).toString(), toWad(1).toString());
        await web3tx(rToken.changeAllocationStrategy,
            "change to the same allocation strategy", {
                inLogs: [{
                    name: "AllocationStrategyChanged",
                    args: {
                        strategy: compoundAS.address,
                        conversionRate: toWad(1)
                    }
                }]
            })(
            compoundAS.address, {
                from: admin
            });
        assert.equal((await rToken.savingAssetConversionRate.call()).toString(), toWad(1).toString());
        assert.equal(wad4human(await token.balanceOf.call(bingeBorrower)), "10.00000");
        assert.equal(wad4human(await token.balanceOf.call(customer1)), "800.00000");
        assert.equal(wad4human(await token.balanceOf.call(cToken.address)), "190.00000");
        assert.equal(wad4human(await cToken.balanceOfUnderlying.call(compoundAS.address)), "100.00051");
        assert.equal(wad4human(await cToken.balanceOfUnderlying.call(customer2)), "100.00051");
        assert.equal(toWad(0)
            .add(await token.balanceOf.call(bingeBorrower))
            .add(await token.balanceOf.call(customer1))
            .add(await token.balanceOf.call(cToken.address))
            .toString(), toWad(1000));
        assert.equal(wad4human(await rToken.balanceOf.call(customer1)), "100.00000");
        assert.equal(wad4human(await rToken.receivedSavingsOf.call(customer1)), "100.00051");

        await web3tx(rToken.changeAllocationStrategy,
            "change allocation strategy 1st time", {
                inLogs: [{
                    name: "AllocationStrategyChanged",
                    args: {
                        strategy: compoundAS2.address,
                        conversionRate: toWad(".099999490001595991")
                    }
                }]
            })(
            compoundAS2.address, {
                from: admin
            });
        assert.equal(wad4human(await token.balanceOf.call(bingeBorrower)), "10.00000");
        assert.equal(wad4human(await token.balanceOf.call(customer1)), "800.00000");
        assert.equal(wad4human(await token.balanceOf.call(cToken.address)), "89.99949");
        assert.equal((await cToken.balanceOfUnderlying.call(compoundAS.address)).toString(), "0");
        assert.equal(wad4human(await cToken.balanceOfUnderlying.call(customer2)), "100.00051");
        assert.equal(wad4human(await token.balanceOf.call(cToken2.address)), "100.00051");
        assert.equal(wad4human(await cToken2.balanceOfUnderlying.call(compoundAS2.address)), "100.00051");
        assert.equal(toWad(0)
            .add(await token.balanceOf.call(bingeBorrower))
            .add(await token.balanceOf.call(customer1))
            .add(await token.balanceOf.call(cToken.address))
            .add(await token.balanceOf.call(cToken2.address))
            .toString(), toWad(1000));
        assert.equal(wad4human(await rToken.balanceOf.call(customer1)), "100.00000");
        assert.equal(wad4human(await rToken.receivedSavingsOf.call(customer1)), "100.00051");

        await web3tx(rToken.changeAllocationStrategy,
            "change allocation strategy 2nd time", {
                inLogs: [{
                    name: "AllocationStrategyChanged",
                    args: {
                        strategy: compoundAS3.address,
                        conversionRate: toWad("99.999490001595991007")
                    }
                }]
            })(
            compoundAS3.address, {
                from: admin
            });
        assert.equal(wad4human(await token.balanceOf.call(bingeBorrower)), "10.00000");
        assert.equal(wad4human(await token.balanceOf.call(customer1)), "800.00000");
        assert.equal(wad4human(await token.balanceOf.call(cToken.address)), "89.99949");
        assert.equal(wad4human(await token.balanceOf.call(cToken3.address)), "100.00051");
        assert.equal((await cToken.balanceOfUnderlying.call(compoundAS.address)).toString(), "0");
        assert.equal((await cToken2.balanceOfUnderlying.call(compoundAS2.address)).toString(), "0");
        assert.equal(wad4human(await cToken3.balanceOfUnderlying.call(compoundAS3.address)), "100.00051");
        assert.equal(toWad(0)
            .add(await token.balanceOf.call(bingeBorrower))
            .add(await token.balanceOf.call(customer1))
            .add(await token.balanceOf.call(cToken.address))
            .add(await token.balanceOf.call(cToken3.address))
            .toString(), toWad(1000));
        assert.equal(wad4human(await rToken.balanceOf.call(customer1)), "100.00000");
        assert.equal(wad4human(await rToken.receivedSavingsOf.call(customer1)), "100.00051");


        // create some reserve in the cToken3 pool for lending in order to make redeemAll solvent
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
        await web3tx(rToken.redeemAll, "rToken.redeemAll to customer1")({
            from: customer1
        });
        assert.equal(wad4human(await token.balanceOf.call(bingeBorrower)), "10.00000");
        assert.equal(wad4human(await token.balanceOf.call(cToken.address)), "89.99949");
        assert.equal(wad4human(await token.balanceOf.call(cToken3.address)), "100.00000");
        assert.equal(wad4human(await token.balanceOf.call(customer1)), "800.00051");
        assert.equal((await cToken.balanceOfUnderlying.call(compoundAS.address)).toString(), "0");
        assert.equal((await cToken2.balanceOfUnderlying.call(compoundAS2.address)).toString(), "0");
        assert.equal(wad4human(await cToken3.balanceOfUnderlying.call(compoundAS3.address)), "100.00000");
        assert.equal(toWad(0)
            .add(await token.balanceOf.call(bingeBorrower))
            .add(await token.balanceOf.call(customer1))
            .add(await token.balanceOf.call(cToken.address))
            .add(await token.balanceOf.call(cToken3.address))
            .toString(), toWad(1000));
        assert.equal(wad4human(await rToken.balanceOf.call(customer1)), "0.00000");
        assert.equal(wad4human(await rToken.balanceOf.call(customer2)), "100.00000");
        assert.equal(wad4human(await rToken.receivedSavingsOf.call(customer1)), "0.00000");
        assert.equal(wad4human(await rToken.receivedSavingsOf.call(customer2)), "100.00000");

        await validateGlobalInvariants();
    });

    it("#23 change hat test", async () => {
        await web3tx(token.approve, "token.approve 100 by customer1")(rToken.address, toWad(100), {
            from: customer1
        });
        await web3tx(rToken.mintWithNewHat, "rToken.mint 100 to customer1 with a hat benefiting customer2(100%)")(
            toWad(100), [customer2], [100], {
                from: customer1
            });
        await expectAccount(customer2, {
            tokenBalance: "0.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "100.00000",
            receivedSavings: "100.00000",
            interestPayable: "0.00000",
        });
        await web3tx(rToken.createHat, "rToken.createHat for customer1 with a hat benefiting customer3(100%)")(
            [customer3], [100], true, {
                from: customer1
            });
        await expectAccount(customer3, {
            tokenBalance: "0.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "100.00000",
            receivedSavings: "100.00000",
            interestPayable: "0.00000",
        });
        await expectAccount(customer2, {
            tokenBalance: "0.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "0.00000",
            receivedSavings: "0.00000",
            interestPayable: "0.00000",
        });

        await validateGlobalInvariants();
    });

    it("#23 change hat test w/ 2 recipients", async () => {
        await web3tx(token.approve, "token.approve 100 by customer1")(rToken.address, toWad(100), {
            from: customer1
        });
        await web3tx(rToken.mintWithNewHat, "rToken.mint 100 to customer1 with a hat benefiting customer2(100%)")(
            toWad(100), [customer2], [100], {
                from: customer1
            });
        await expectAccount(customer2, {
            tokenBalance: "0.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "100.00000",
            receivedSavings: "100.00000",
            interestPayable: "0.00000",
        });
        await web3tx(rToken.createHat, "rToken.createHat for customer1 with a hat benefiting customer3(100%)")(
            [customer3, customer4], [90,10], true, {
                from: customer1
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
            receivedLoan: "90.00000",
            receivedSavings: "90.00000",
            interestPayable: "0.00000",
        });
        await expectAccount(customer4, {
            tokenBalance: "0.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "10.00000",
            receivedSavings: "10.00000",
            interestPayable: "0.00000",
        });

        await validateGlobalInvariants();
    });

    it("#24 complex functional test", async () => {
        // Check that the current saving/allocation strategy is the Compound Allocation Strategy
        assert.equal(await rToken.getCurrentSavingStrategy(), compoundAS.address);
        assert.equal(await rToken.getCurrentAllocationStrategy(), compoundAS.address);
        // Create hat
        await web3tx(rToken.createHat, "rToken.createHat for customer1 benefiting admin and customer3 10/90")(
            [admin, customer3], [10, 90], true, {
                from: customer1
            }
        );
        // Check that the largest hat ID is as created so far
        assert.equal(await rToken.getMaximumHatID(), 1);
        await web3tx(token.approve, "token.approve 1000 by customer1")(rToken.address, toWad(1000), {
            from: customer1
        });
        // customer1 mints with hat ID 1
        await web3tx(rToken.mintWithSelectedHat, "rToken.mintWithSelectedHat 1000 to customer1 with the first hat", {
            inLogs: [{
                name: "Transfer"
            }]
        })(toWad(1000), 1, {
            from: customer1
        });
        await expectAccount(admin, {
            tokenBalance: "0.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "100.00000",
            receivedSavings: "100.00000",
            interestPayable: "0.00000",
        });
        await expectAccount(customer1, {
            tokenBalance: "1000.00000",
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
            receivedLoan: "900.00000",
            receivedSavings: "900.00000",
            interestPayable: "0.00000",
        });
        await expectAccount(customer4, {
            tokenBalance: "0.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "0.00000",
            receivedSavings: "0.00000",
            interestPayable: "0.00000",
        });
        // Accumulate interest
        await doBingeBorrowing(142);
        await expectAccount(admin, {
            tokenBalance: "0.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "100.00000",
            receivedSavings: "100.00014",
            interestPayable: "0.00014",
        });
        await expectAccount(customer1, {
            tokenBalance: "1000.00000",
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
            receivedLoan: "900.00000",
            receivedSavings: "900.00128",
            interestPayable: "0.00128",
        });
        await expectAccount(customer4, {
            tokenBalance: "0.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "0.00000",
            receivedSavings: "0.00000",
            interestPayable: "0.00000",
        });
        // owner changeHat to different recipient
        await web3tx(rToken.createHat, "rToken.createHat for customer1 benefiting customer2 and customer4 49/51")(
            [customer2, customer4], [49, 51], true, {
                from: customer1
            }
        );
        // Accumulate interest
        await doBingeBorrowing(298);
        await expectAccount(admin, {
            tokenBalance: "0.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "0.00000",
            receivedSavings: "0.00014",
            interestPayable: "0.00014",
        });
        await expectAccount(customer1, {
            tokenBalance: "1000.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "0.00000",
            receivedSavings: "0.00000",
            interestPayable: "0.00000",
        });
        await expectAccount(customer2, {
            tokenBalance: "0.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "490.00000",
            receivedSavings: "490.00293",
            interestPayable: "0.00293",
        });
        await expectAccount(customer3, {
            tokenBalance: "0.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "0.00000",
            receivedSavings: "0.00129",
            interestPayable: "0.00129",
        });
        await expectAccount(customer4, {
            tokenBalance: "0.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "510.00000",
            receivedSavings: "510.00305",
            interestPayable: "0.00304",
        });
        assert.deepEqual(parseSavingAssetBalance(await rToken.getSavingAssetBalance.call()), {
            rAmount: "1000.00740",
            sOriginalAmount: "10000.00000"
        });

        await validateGlobalInvariants();
    });

    it("#25 change allocation strategy multiple times", async () => {
        let compoundAS2;
        {
            const result = await createCompoundAllocationStrategy(toWad(1));
            compoundAS2 = result.compoundAS;
        }
        // Deploy the rToken logic/library contract
        rTokenLogic = await web3tx(RToken.new, "RToken.new")(
            {
                from: admin
            });
        // Get the init code for rToken
        const rTokenConstructCode = rTokenLogic.contract.methods.initialize(
            compoundAS2.address,
            "RToken Test2",
            "RTOKEN2",
            18).encodeABI();

        // Deploy the Proxy, using the init code for rToken
        const proxy = await web3tx(Proxy.new, "Proxy.new")(
            rTokenConstructCode, rTokenLogic.address, {
                from: admin
            });
        // Create the rToken object using the proxy address
        rToken = await RToken.at(proxy.address);

        await web3tx(compoundAS2.transferOwnership, "compoundAS2.transferOwnership")(rToken.address);
        SELF_HAT_ID = await rToken.SELF_HAT_ID.call();
        // Create hat
        await web3tx(rToken.createHat, "rToken.createHat for customer1 benefiting admin and customer3 10/90")(
            [admin, customer3], [10, 90], true, {
                from: customer1
            }
        );
        await web3tx(token.approve, "token.approve 100 by customer1")(rToken.address, toWad(100), {
            from: customer1
        });
        // customer1 mints with hat ID 1
        await web3tx(rToken.mintWithSelectedHat, "rToken.mintWithSelectedHat 100 to customer1 with the first hat", {
            inLogs: [{
                name: "Transfer"
            }]
        })(toWad(100), 1, {
            from: customer1
        });
        await web3tx(rToken.redeemAndTransfer, "rToken.redeem 100 of customer1 to customer3", {
            inLogs: [{
                name: "Transfer",
                args: {
                    from: customer1,
                    to: ZERO_ADDRESS,
                    value: toWad(100)
                }
            }]
        })(customer3, toWad(100), {
            from: customer1
        });
        assert.equal(wad4human(await token.balanceOf.call(customer3)), "100.00000");
        assert.deepEqual(parseSavingAssetBalance(await rToken.getSavingAssetBalance.call()), {
            rAmount: "0.00000",
            sOriginalAmount: "0.00000"
        });

        await validateGlobalInvariants();
    });

    it("#27 normal operations with self-recipient hatter", async () => {
        await web3tx(token.approve, "token.approve 100 by customer1")(rToken.address, toWad(100), {
            from: customer1
        });
        await expectRevert(rToken.mintWithSelectedHat(toWad(1), 1), "Invalid hat ID");
        await web3tx(rToken.mintWithNewHat, "rToken.mintWithSelectedHat 100 to customer1 with the self hat")(
            toWad(100), [customer1], [100], {
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
            receivedLoan: "100.00000",
            receivedSavings: "100.00000",
            interestPayable: "0.00000",
        });
        await expectAccount(customer2, {
            tokenBalance: "20.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "0.00000",
            receivedSavings: "0.00000",
            interestPayable: "0.00000",
        });

        await web3tx(rToken.transfer, "rToken.transfer all from customer2 back to customer1")(
            customer1, toWad(20), {
                from: customer2
            });
        await expectAccount(customer1, {
            tokenBalance: "100.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "100.00000",
            receivedSavings: "100.00000",
            interestPayable: "0.00000",
        });
        await expectAccount(customer2, {
            tokenBalance: "0.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "0.00000",
            receivedSavings: "0.00000",
            interestPayable: "0.00000",
        });

        // Validate global stats
        await validateGlobalInvariants();
        assert.deepEqual(parseGlobalStats(await rToken.getGlobalStats.call()), {
            totalSupply: "100.00000",
            totalSavingsAmount: "100.00000"
        });
        assert.deepEqual(parseHatStats(await rToken.getHatStats(0)), {
            useCount: zeroHatUseCount(2),
            totalLoans: "0.00000",
            totalSavings: "0.00000",
        });
        assert.deepEqual(parseHatStats(await rToken.getHatStats(1)), {
            useCount: "2",
            totalLoans: "100.00000",
            totalSavings: "100.00000",
        });
    });
});
