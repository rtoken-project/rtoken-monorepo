const CoreLibrary = artifacts.require("CoreLibrary");
const LendingPool = artifacts.require("LendingPool");
const LendingPoolCore = artifacts.require("LendingPoolCore");
const LendingPoolAddressesProvider = artifacts.require("LendingPoolAddressesProvider");
const LendingPoolConfigurator = artifacts.require("LendingPoolConfigurator");
const LendingPoolDataProvider = artifacts.require("LendingPoolDataProvider");
const LendingPoolParametersProvider = artifacts.require("LendingPoolParametersProvider");
const LendingRateOracle = artifacts.require("LendingRateOracle");
const PriceOracle = artifacts.require("PriceOracle");
const DefaultReserveInterestRateStrategy = artifacts.require("DefaultReserveInterestRateStrategy");
const FeeProvider = artifacts.require("FeeProvider");
const AToken = artifacts.require("AToken");
const AaveAllocationStrategy = artifacts.require("AaveAllocationStrategy");

const ERC20DetailedMintable = artifacts.require("ERC20DetailedMintable");
const RToken = artifacts.require("RToken");
const Proxy = artifacts.require("Proxy");
const { time, expectRevert } = require("@openzeppelin/test-helpers");
const { web3tx, wad4human, toWad } = require("@decentral.ee/web3-test-helpers");

const expect = require("chai").expect;

contract("RTokenWithAave", accounts => {
    const MAX_UINT256 = "115792089237316195423570985008687907853269984665640564039457584007913129639935";
    const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

    const admin = accounts[0];
    const bingeBorrower = accounts[1];
    const customer1 = accounts[2];
    const customer2 = accounts[3];
    const customer3 = accounts[4];
    const customer4 = accounts[5];
    let token;
    let aToken;
    let lendingPool;
    let lendingPoolCore;
    let aaveAS;
    let rToken;
    let rTokenLogic;

    async function createAaveAllocationStrategy() {
        const coreLibrary = await CoreLibrary.new();
        await LendingPoolCore.link("CoreLibrary", coreLibrary.address);

        let lendingPoolCore = await web3tx(LendingPoolCore.new, "LendingPoolCore.new")({ from: admin });
        let lendingPool = await web3tx(LendingPool.new, "LendingPool.new")({ from: admin });
        let lendingPoolConfigurator = await web3tx(LendingPoolConfigurator.new, "LendingPoolConfigurator.new")({ from: admin });
        let lendingPoolDataProvider = await web3tx(LendingPoolDataProvider.new, "LendingPoolDataProvider.new")({ from: admin });
        let lendingPoolParametersProvider = await web3tx(LendingPoolParametersProvider.new, "LendingPoolParametersProvider.new")({ from: admin });
        let lendingRateOracle = await web3tx(LendingRateOracle.new, "LendingRateOracle.new")({ from: admin });
        let priceOracle = await web3tx(PriceOracle.new, "PriceOracle.new")({ from: admin });

        let feeProvider = await web3tx(FeeProvider.new, "FeeProvider.new")({ from: admin });

        const addressesProvider = await web3tx(LendingPoolAddressesProvider.new, "LendingPoolAddressesProvider.new")({ from: admin });
        
        await web3tx(addressesProvider.setLendingRateOracle, "addressesProvider.setLendingRateOracle")(lendingRateOracle.address, { from: admin });
        await web3tx(lendingRateOracle.setMarketBorrowRate, "lendingRateOracle.setMarketBorrowRate")(token.address, "10000000000000000000000000000", { from: admin });

        await web3tx(addressesProvider.setPriceOracle, "addressesProvider.setPriceOracle")(priceOracle.address, { from: admin });
        await web3tx(priceOracle.setEthUsdPrice, "priceOracle.setEthUsdPrice")("200000000000000000000", { from: admin });
        await web3tx(priceOracle.setAssetPrice, "priceOracle.setAssetPrice")(token.address, "1000000000000000000", { from: admin });

        await web3tx(addressesProvider.setLendingPoolCoreImpl, "addressesProvider.setLendingPoolCoreImpl")(lendingPoolCore.address, { from: admin });
        lendingPoolCore = await LendingPoolCore.at(await addressesProvider.getLendingPoolCore.call());

        await web3tx(addressesProvider.setLendingPoolConfiguratorImpl, "addressesProvider.setLendingPoolConfiguratorImpl")(lendingPoolConfigurator.address, { from: admin });
        lendingPoolConfigurator = await LendingPoolConfigurator.at(await addressesProvider.getLendingPoolConfigurator.call());

        await web3tx(addressesProvider.setLendingPoolDataProviderImpl, "addressesProvider.setLendingPoolDataProviderImpl")(lendingPoolDataProvider.address, { from: admin });
        lendingPoolDataProvider = await LendingPoolDataProvider.at(await addressesProvider.getLendingPoolDataProvider.call());

        await web3tx(addressesProvider.setLendingPoolParametersProviderImpl, "addressesProvider.setLendingPoolParametersProviderImpl")(lendingPoolParametersProvider.address, { from: admin });
        lendingPoolParametersProvider = await LendingPoolParametersProvider.at(await addressesProvider.getLendingPoolParametersProvider.call());

        await web3tx(addressesProvider.setFeeProviderImpl, "addressesProvider.setFeeProviderImpl")(feeProvider.address, { from: admin });
        feeProvider = await FeeProvider.at(await addressesProvider.getFeeProvider.call());

        await web3tx(addressesProvider.setLendingPoolImpl, "addressesProvider.setLendingPoolImpl")(lendingPool.address, { from: admin });
        lendingPool = await LendingPool.at(await addressesProvider.getLendingPool.call());

        await web3tx(addressesProvider.setLendingPoolManager, "addressesProvider.setLendingPoolManager")(admin, { from: admin });

        await web3tx(lendingPoolConfigurator.refreshLendingPoolCoreConfiguration, "lendingPoolConfigurator.refreshLendingPoolCoreConfiguration")({ from: admin });

        const defaultReserveInterestRateStrategy = await web3tx(DefaultReserveInterestRateStrategy.new, "DefaultReserveInterestRateStrategy.new")( 
            token.address,
            addressesProvider.address,
            "1000000000000000000000000000", // _baseVariableBorrowRate
            "5000000000000000000000000000", // _variableRateSlope1
            "50000000000000000000000000000", // _variableRateSlope2
            "16000000000000000000000000000", // _stableRateSlope1
            "60000000000000000000000000000", // _stableRateSlope2
            { from: admin });

        await web3tx(lendingPoolConfigurator.initReserve, "lendingPoolConfigurator.initReserve")(
            token.address,
            "18",
            defaultReserveInterestRateStrategy.address, {
                from: admin
            });

        const aToken = await AToken.at(await lendingPoolCore.getReserveATokenAddress(token.address));

        const aaveAS = await web3tx(AaveAllocationStrategy.new, "AaveAllocationStrategy.new")(
            aToken.address, addressesProvider.address, {
                from: admin
            }
        );

        await web3tx(lendingPoolConfigurator.enableBorrowingOnReserve, "lendingPoolConfigurator.enableBorrowingOnReserve")(token.address, true, { from: admin });
        await web3tx(lendingPoolConfigurator.enableReserveAsCollateral, "lendingPoolConfigurator.enableReserveAsCollateral")(
            token.address,
            "1000", // _baseLTVasCollateral
            0, // _liquidationThreshold
            0, // _liquidationBonus
            { from: admin });

        return { aToken, aaveAS, lendingPool, lendingPoolCore };
    }

    before(async () => {
        console.log("admin is", admin);
        console.log("bingeBorrower is", bingeBorrower);
        console.log("customer1 is", customer1);
        console.log("customer2 is", customer2);
        console.log("customer3 is", customer3);
    });

    beforeEach(async () => {
        token = await web3tx(ERC20DetailedMintable.new, "ERC20Mintable.new")("DAI", "DAI", { from: admin });
        await web3tx(token.mint, "token.mint 1000 -> customer1")(customer1, toWad(1000), { from: admin });

        {
            const result = await createAaveAllocationStrategy();
            aToken = result.aToken;
            aaveAS = result.aaveAS;
            lendingPool = result.lendingPool;
            lendingPoolCore = result.lendingPoolCore;
        }
        
        // Deploy the rToken logic/library contract
        rTokenLogic = await web3tx(RToken.new, "RToken.new")(
            {
                from: admin
            });
        // Get the init code for rToken
        const rTokenConstructCode = rTokenLogic.contract.methods.initialize(
            aaveAS.address,
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

        await web3tx(aaveAS.transferOwnership, "aaveAS.transferOwnership")(rToken.address);
    });

    function zeroHatUseCount(u) {
        return web3.utils.toBN(MAX_UINT256).sub(web3.utils.toBN(u)).toString();
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

    async function doBingeBorrowing(nBlocks = 200) {
        console.log(`Before binge borrowing: 1 aToken = ${wad4human(await aaveAS.exchangeRateStored.call())} Token`);
        const borrowAmount = toWad(100);
        const mintAmount = toWad(150);
        // mint token as collateral
        await web3tx(token.mint, "token.mint to bingeBorrower")(bingeBorrower, mintAmount, { from: admin });
        // deposit token as collateral
        await web3tx(token.approve, "token.approve for lending pool core -> bingeBorrower")(lendingPoolCore.address, mintAmount, { from: bingeBorrower });
        await web3tx(lendingPool.deposit, "lendingPool.deposit for bingeBorrower")(token.address, mintAmount, 0, { from: bingeBorrower });
        await web3tx(lendingPool.borrow, "lendingPool.borrow 10 to bingeBorrower")(token.address, borrowAmount, 2 /* variable rate */, 0, {
            from: bingeBorrower
        });
        await waitForInterest(nBlocks);
        console.log(`After binge borrowing: 1 aToken = ${wad4human(await aaveAS.exchangeRateStored.call())} Token`);
    }

    async function waitForInterest(nBlocks = 200) {
        console.log(`Wait for ${nBlocks} blocks...`);
        //while(--nBlocks) await time.advanceBlock();
        await time.increase(1800); // 30m
        await web3tx(aaveAS.accrueInterest, "aaveAS.accrueInterest")({ from: admin });
    }

    async function expectAccount(account, balances, decimals, approx = false) {
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

        if (approx) {
            expect(parseFloat(tokenBalance), "tokenBalance").to.be.closeTo(parseFloat(balances.tokenBalance), 0.001);
            expect(parseFloat(receivedLoan), "receivedLoan").to.be.closeTo(parseFloat(balances.receivedLoan), 0.001);
            expect(parseFloat(receivedSavings), "receivedSavings").to.be.closeTo(parseFloat(balances.receivedSavings), 0.001);
            expect(parseFloat(interestPayable), "interestPayable").to.be.closeTo(parseFloat(balances.interestPayable), 0.001);
            expect(parseFloat(cumulativeInterest), "cumulativeInterest").to.be.closeTo(parseFloat(balances.cumulativeInterest), 0.001);
        } else {
            assert.deepEqual({
                tokenBalance,
                receivedLoan,
                receivedSavings,
                interestPayable,
                cumulativeInterest
            }, balances, `expectAccount ${accountName}`);
        }
        
    }

    async function expectGlobalStats(stats) {
        const parsed = parseGlobalStats(await rToken.getGlobalStats.call());
        expect(parseFloat(stats.totalSupply), "totalSupply").to.be.closeTo(parseFloat(parsed.totalSupply), 0.001);
        expect(parseFloat(stats.totalSavingsAmount), "totalSavingsAmount").to.be.closeTo(parseFloat(parsed.totalSavingsAmount), 0.001);

    }

    async function expectHatStats(stats) {
        const parsed = parseHatStats(await rToken.getHatStats(0));
        expect(parseFloat(stats.useCount), "useCount").to.be.closeTo(parseFloat(parsed.useCount), 0.001);
        expect(parseFloat(stats.totalLoans), "totalLoans").to.be.closeTo(parseFloat(parsed.totalLoans), 0.001);
        expect(parseFloat(stats.totalSavings), "totalSavings").to.be.closeTo(parseFloat(parsed.totalSavings), 0.001);
    }

    function expectClose(a, b) {
        expect(parseFloat(a)).to.be.closeTo(parseFloat(b), 0.001);
    }

    it("#0 initial test condition", async () => {
        assert.equal(wad4human(await rToken.totalSupply.call()), "0.00000");
        assert.equal(wad4human(await aToken.balanceOf.call(customer1)), "0.00000");
        assert.equal(wad4human(await token.balanceOf.call(customer1)), "1000.00000");
    });

    it("#1 normal operations with zero hatter", async () => {
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
        }, 5, true);

        // STEP 2: binge borrowing
        await doBingeBorrowing();
        await expectAccount(customer1, {
            tokenBalance: "100.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "100.00000",
            receivedSavings: "100.00800",
            interestPayable: "0.00800",
        }, 5, true);
        await expectGlobalStats({
            totalSupply: "100.00000",
            totalSavingsAmount: "100.00800"
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
        expectClose(wad4human(await rToken.balanceOf.call(customer1)), "90.00800");
        await expectAccount(customer1, {
            tokenBalance: "90.00800",
            cumulativeInterest: "0.00800",
            receivedLoan: "90.00000",
            receivedSavings: "90.00888",
            interestPayable: "0.00015",
        }, 5, true);

        // STEP 5: payInterest to customer1
        await web3tx(rToken.payInterest, "rToken.payInterest to customer1")(customer1, { from : admin });
        assert.equal(wad4human(await token.balanceOf.call(customer1)), "910.00000");
        expectClose(wad4human(await rToken.balanceOf.call(customer1)), "90.008888");
        await expectAccount(customer1, {
            tokenBalance: "90.00888",
            cumulativeInterest: "0.00888",
            receivedLoan: "90.00000",
            receivedSavings: "90.00888",
            interestPayable: "0.00000",
        }, 5, true);
        await web3tx(rToken.payInterest, "rToken.payInterest to customer1 again")(customer1, { from : admin });
        await expectAccount(customer1, {
            tokenBalance: "90.00889",
            cumulativeInterest: "0.00889",
            receivedLoan: "90.00000",
            receivedSavings: "90.00889",
            interestPayable: "0.00000",
        }, 5, true);
        await expectGlobalStats({
            totalSupply: "90.00889",
            totalSavingsAmount: "90.00800"
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
            tokenBalance: "78.00801",
            cumulativeInterest: "0.00801",
            receivedLoan: "78.00000",
            receivedSavings: "78.00801",
            interestPayable: "0.00000",
        }, 5, true);
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
            tokenBalance: "83.00800",
            cumulativeInterest: "0.00800",
            receivedLoan: "83.00000",
            receivedSavings: "83.00800",
            interestPayable: "0.00000",
        }, 5, true);
        await expectAccount(customer3, {
            tokenBalance: "5.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "5.00000",
            receivedSavings: "5.00000",
            interestPayable: "0.00000",
        });

        // Validate global stats
        await expectGlobalStats({
            totalSupply: "88.00800",
            totalSavingsAmount: "88.00800"
        });
        await expectHatStats({
            useCount: zeroHatUseCount(0),
            totalLoans: "88.00000",
            totalSavings: "88.00800",
        });
    });
});
