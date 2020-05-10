

const DaiMock = artifacts.require("DaiMock");
const LendingPool = artifacts.require("LendingPool");
const LendingPoolAddressesProvider = artifacts.require("LendingPoolAddressesProvider");
const LendingPoolDataProvider = artifacts.require("LendingPoolDataProvider");
const CoreLibrary = artifacts.require("CoreLibrary");
const LendingPoolCore = artifacts.require("LendingPoolCore");
const LendingPoolConfigurator = artifacts.require("LendingPoolConfigurator");
const LendingPoolParametersProvider = artifacts.require("LendingPoolParametersProvider");
const LendingRateOracle = artifacts.require("LendingRateOracle");
const PriceOracle = artifacts.require("PriceOracle");
const DefaultReserveInterestRateStrategy = artifacts.require("DefaultReserveInterestRateStrategy");
const AToken = artifacts.require("AToken");
const AaveAllocationStrategy = artifacts.require("AaveAllocationStrategy");
const FeeProvider = artifacts.require("FeeProvider");
const RToken = artifacts.require("RToken");
const Proxy = artifacts.require("Proxy");

const { web3tx, wad4human, toWad, fromDecimals, toDecimals} = require("@decentral.ee/web3-test-helpers");

const {
  BN, 
  time,
  constants,
  expectEvent,
  expectRevert,
} = require('@openzeppelin/test-helpers');

contract("RToken with Aave Strategy", accounts => {

    const MAX_UINT256 = "115792089237316195423570985008687907853269984665640564039457584007913129639935";
    const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

    const admin = accounts[0];
    const bingeBorrower = accounts[1];
    const customer1 = accounts[2];
    const customer2 = accounts[3];
    const customer3 = accounts[4];
    const customer4 = accounts[5];
    let dai;
    let adai;
    let aaveAS;
    let rdai;
    let rdaiLogic;
    let SELF_HAT_ID;
    let lendingPool;
    let lendingPoolCore;


    async function createAaveAllocationStrategy() {
        const coreLibrary = await CoreLibrary.new()
        await LendingPoolCore.link("CoreLibrary", coreLibrary.address);

        lendingPoolCore = await LendingPoolCore.new({from:admin});
        lendingPool = await LendingPool.new({from:admin});
        lendingPoolConfigurator = await LendingPoolConfigurator.new({from:admin});
        lendingPoolDataProvider = await LendingPoolDataProvider.new({from:admin});
        lendingPoolParametersProvider = await LendingPoolParametersProvider.new({from:admin});
        lendingRateOracle = await LendingRateOracle.new({from:admin});
        priceOracle = await PriceOracle.new({from:admin});
        feeProvider = await FeeProvider.new({from:admin});
        lendingPoolAddressesProvider = await LendingPoolAddressesProvider.new({from:admin});
        
        await lendingPoolAddressesProvider.setLendingRateOracle(lendingRateOracle.address,{from:admin});
        await lendingRateOracle.setMarketBorrowRate(dai.address, "10000000000000000000000000000",{from:admin});

        await lendingPoolAddressesProvider.setPriceOracle(priceOracle.address,{from:admin});
        await priceOracle.setEthUsdPrice("500000000000000000",{from:admin});
        await priceOracle.setAssetPrice(dai.address, "5000000000000000",{from:admin});

        await lendingPoolAddressesProvider.setLendingPoolCoreImpl(lendingPoolCore.address,{from:admin});
        lendingPoolCore = await LendingPoolCore.at(await lendingPoolAddressesProvider.getLendingPoolCore());

        await lendingPoolAddressesProvider.setLendingPoolConfiguratorImpl(lendingPoolConfigurator.address,{from:admin});
        lendingPoolConfigurator = await LendingPoolConfigurator.at(await lendingPoolAddressesProvider.getLendingPoolConfigurator());

        await lendingPoolAddressesProvider.setLendingPoolDataProviderImpl(lendingPoolDataProvider.address,{from:admin});
        lendingPoolDataProvider = await LendingPoolDataProvider.at(await lendingPoolAddressesProvider.getLendingPoolDataProvider());

        await lendingPoolAddressesProvider.setLendingPoolParametersProviderImpl(lendingPoolParametersProvider.address,{from:admin});
        lendingPoolParametersProvider = await LendingPoolParametersProvider.at(await lendingPoolAddressesProvider.getLendingPoolParametersProvider());

        await lendingPoolAddressesProvider.setFeeProviderImpl(feeProvider.address,{from:admin});
        feeProvider = await FeeProvider.at(await lendingPoolAddressesProvider.getFeeProvider());

        await lendingPoolAddressesProvider.setLendingPoolImpl(lendingPool.address,{from:admin});
        lendingPool = await LendingPool.at(await lendingPoolAddressesProvider.getLendingPool());

        await lendingPoolAddressesProvider.setLendingPoolManager(admin,{from:admin});

        await lendingPoolConfigurator.refreshLendingPoolCoreConfiguration({from:admin});

        defaultReserveInterestRateStrategy = await DefaultReserveInterestRateStrategy.new(
            dai.address,
            lendingPoolAddressesProvider.address,
            "1000000000000000000000000000",
            "50000000000000000000000000000",
            "50000000000000000000000000000",
            "50000000000000000000000000000",
            "50000000000000000000000000000",
            {from:admin});

        await lendingPoolConfigurator.initReserve(dai.address,await dai.decimals(),defaultReserveInterestRateStrategy.address,{from: admin});

        adai = await AToken.at(await lendingPoolCore.getReserveATokenAddress(dai.address));

        aaveAS = await AaveAllocationStrategy.new(adai.address, lendingPoolAddressesProvider.address,{from: admin});

        await lendingPoolConfigurator.enableBorrowingOnReserve(dai.address, true,{from:admin});
        await lendingPoolConfigurator.enableReserveAsCollateral(dai.address,"1000",0,0,{from:admin});

        return { adai, aaveAS, lendingPool, lendingPoolCore };
    }

    before(async () => {
        console.log("admin is", admin);
        console.log("bingeBorrower is", bingeBorrower);
        console.log("customer1 is", customer1);
        console.log("customer2 is", customer2);
        console.log("customer3 is", customer3);
    });

    beforeEach(async () => {

        dai = await DaiMock.new("dai token","dai",18,{from: admin})
        dai.mint(customer1,toWad(1000),{from:admin});
        await createAaveAllocationStrategy();
        rdaiLogic = await web3tx(RToken.new, "RToken.new")({from: admin});
        const rTokenConstructCode = rdaiLogic.contract.methods.initialize(aaveAS.address,"RToken Test","RTOKEN",18).encodeABI();
        const proxy = await Proxy.new(rTokenConstructCode, rdaiLogic.address,{from: admin});
        rdai = await RToken.at(proxy.address);
        await aaveAS.transferOwnership(rdai.address);
        SELF_HAT_ID = await rdai.SELF_HAT_ID.call();
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

    async function doBingeBorrowing() {
        // the following statement is not valid since 1 aDai is equal to 1 Dai
        // console.log(`Before binge borrowing: 1 aToken = ${wad4human(await aaveAS.exchangeRateStored.call())} Token`);
        const borrowAmount = toWad(10);
        const mintAmount = toWad(10000);
        await dai.mint(bingeBorrower, mintAmount,{from:admin});
        await dai.approve(lendingPoolCore.address, mintAmount,{from: bingeBorrower });
        await lendingPool.deposit(dai.address, mintAmount, 0,{from: bingeBorrower });
        const rate_type = 2;
        const tx = await lendingPool.borrow(dai.address, borrowAmount, rate_type , 0,{from: bingeBorrower});
    }

    async function waitForInterest(nBlocks = 200) {
        console.log(`Wait for ${nBlocks} blocks...`);
        while(--nBlocks) await time.advanceBlock();
        await web3tx(aaveAS.accrueInterest, "aaveAS.accrueInterest")({from:admin});
    }


    async function expectAccount(account, balances, decimals, approx = false) {
        let accountName;
        if (account === admin) accountName = "admin";
        else if (account === customer1) accountName = "customer1";
        else if (account === customer2) accountName = "customer2";
        else if (account === customer3) accountName = "customer3";
        else if (account === customer4) accountName = "customer4";

        const tokenBalance = wad4human(await rdai.balanceOf.call(account), decimals);
        console.log(`${accountName} tokenBalance ${tokenBalance} expected ${balances.tokenBalance}`);

        const receivedLoan = wad4human(await rdai.receivedLoanOf.call(account), decimals);
        console.log(`${accountName} receivedLoan ${receivedLoan} expected ${balances.receivedLoan}`);

        const receivedSavings = wad4human(await rdai.receivedSavingsOf.call(account), decimals);
        console.log(`${accountName} receivedSavings ${receivedSavings} expected ${balances.receivedSavings}`);

        const interestPayable = wad4human(await rdai.interestPayableOf.call(account), decimals);
        console.log(`${accountName} interestPayable ${interestPayable} expected ${balances.interestPayable}`);

        const accountStats = await rdai.getAccountStats.call(account);

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
            const stats = await rdai.getAccountStats.call(account);
            totalSupplyByAccounts = totalSupplyByAccounts
                .add(web3.utils.toBN(await rdai.balanceOf.call(account)));
            totalSavingsAmountByAccounts = totalSavingsAmountByAccounts
                .add(web3.utils.toBN(await rdai.receivedSavingsOf.call(account)));
            totalReceivedLoansByAccounts = totalReceivedLoansByAccounts
                .add(web3.utils.toBN(await rdai.receivedLoanOf.call(account)));
            totalDebtFreeInterestByAccounts = totalDebtFreeInterestByAccounts
                .add(web3.utils.toBN(stats.cumulativeInterest))
                .sub(web3.utils.toBN(stats.rInterest));
        }

        const globalStats = await rdai.getGlobalStats.call();
        assert.deepEqual({
            totalSupply: totalSupplyByAccounts.toString(),
            totalSavingsAmount: wad4human(totalSavingsAmountByAccounts, 12)
        }, {
            totalSupply: globalStats.totalSupply.toString(),
            totalSavingsAmount: wad4human(globalStats.totalSavingsAmount, 12)
        }, "invariants: accountStats vs globalStats");

        const nHats = parseInt((await rdai.getMaximumHatID.call()).toString()) + 1;
        let totalReceivedLoansByHats = toWad(0);
        let totalSavingsByHats = toWad(0);
        for (let i = 0; i <= nHats; ++i) {
            let hatID = i;
            if (i === nHats) hatID = SELF_HAT_ID;
            const stats = await rdai.getHatStats.call(hatID);
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
        assert.equal(wad4human(await rdai.totalSupply.call()), "0.00000");
        assert.equal(wad4human(await adai.balanceOf.call(customer1)), "0.00000");
        assert.equal(wad4human(await dai.balanceOf.call(customer1)), "1000.00000");
    });

    it("#2 normal operations with zero hatter", async () => {
        // STEP 1: mint 100 -> customer1
        await web3tx(dai.approve, "dai.approve 100 by customer1")(rdai.address, toWad(100), {
            from: customer1
        });
        await expectRevert.unspecified(rdai.mint(toWad(100.1),{from: customer1}));
        console.log(await dai.balanceOf(customer1)/1)
        console.log(await dai.allowance(customer1,rdai.address)/1)

        await web3tx(rdai.mint, "rdai.mint 100 to customer1", {
            inLogs: [{
                name: "Transfer",
                args: {
                    from: ZERO_ADDRESS,
                    to: customer1,
                    value: toWad(100)
                }
            }]
        })(toWad(100), { from: customer1 });

        assert.equal(wad4human(await dai.balanceOf.call(customer1)), "900.00000");
        assert.equal(wad4human(await rdai.balanceOf.call(customer1)), "100.00000");
        
        await expectAccount(customer1, {
            tokenBalance: "100.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "100.00000",
            receivedSavings: "100.00000",
            interestPayable: "0.00000",
        });

        // STEP 2: binge borrowing
        // get the increase of aToken balance (that represent the earnign from all the deposited balances in rdai contract) form aave allocation strategy contract since it will reflect the exact earning
        // to verifiy that the implemented staking algorithm is doing the right computation.

        await doBingeBorrowing();
        await time.increase(5*24*3600);
        var asBalanceNext = await adai.balanceOf(aaveAS.address);

        var earning = asBalanceNext.sub(new BN(toWad(100)));

        await expectAccount(customer1, {
            tokenBalance: "100.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "100.00000",
            receivedSavings: wad4human(earning.add(new BN(toWad(100)))),
            interestPayable: wad4human(earning),
        });

        assert.deepEqual(parseGlobalStats(await rdai.getGlobalStats.call()), {
            totalSupply: "100.00000",
            totalSavingsAmount: wad4human(earning.add(new BN(toWad(100))))
        });
        await expectRevert(rdai.redeem("0", { from: customer1 }), "Redeem amount cannot be zero");

        // STEP 3: redeem 10 by customer1
        await time.increase(5*24*3600); 
        await web3tx(rdai.redeem, "rdai.redeem 10 by customer1", {
            inLogs: [{
                name: "Transfer",
                args: {
                    from: customer1,
                    to: ZERO_ADDRESS,
                    value: toWad(10)
                }
            }]
        })(toWad(10), { from: customer1 });
        
        asBalanceNext = await adai.balanceOf(aaveAS.address);
        earning = asBalanceNext.sub(new BN(toWad(90)));

        assert.equal(wad4human(await dai.balanceOf.call(customer1)), "910.00000");
        assert.equal(wad4human(await rdai.balanceOf.call(customer1)), wad4human(earning.add(new BN(toWad(90)))));

        await expectAccount(customer1, {
            tokenBalance: wad4human(earning.add(new BN(toWad(90)))),
            cumulativeInterest: wad4human(earning),
            receivedLoan: "90.00000",
            receivedSavings: wad4human(earning.add(new BN(toWad(90)))),
            interestPayable: "0.00000",
        });

        // STEP 5: payInterest to customer1
        await time.increase(5*24*3600);
        await web3tx(rdai.payInterest, "rdai.payInterest to customer1", {
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

        asBalanceNext = await adai.balanceOf(aaveAS.address);
        earning = asBalanceNext.sub(new BN(toWad(90)));

        assert.equal(wad4human(await dai.balanceOf.call(customer1)), "910.00000");
        assert.equal(wad4human(await rdai.balanceOf.call(customer1)), wad4human(earning.add(new BN(toWad(90)))));
        await expectAccount(customer1, {
            tokenBalance: wad4human(earning.add(new BN(toWad(90)))),
            cumulativeInterest: wad4human(earning),
            receivedLoan: "90.00000",
            receivedSavings: wad4human(earning.add(new BN(toWad(90)))),
            interestPayable: "0.00000",
        });

        await time.increase(5*24*3600);
        await web3tx(rdai.payInterest, "rdai.payInterest to customer1 again", {
            inLogs: [{
                name: "InterestPaid"
            }]
        })(customer1, { from : admin });

        asBalanceNext = await adai.balanceOf(aaveAS.address);
        earning = asBalanceNext.sub(new BN(toWad(90)));

        await expectAccount(customer1, {
            tokenBalance: wad4human(earning.add(new BN(toWad(90)))),
            cumulativeInterest: wad4human(earning),
            receivedLoan: "90.00000",
            receivedSavings: wad4human(earning.add(new BN(toWad(90)))),
            interestPayable: "0.00000",
        });
        assert.deepEqual(parseGlobalStats(await rdai.getGlobalStats.call()), {
            totalSupply: wad4human(earning.add(new BN(toWad(90)))),
            totalSavingsAmount: wad4human(earning.add(new BN(toWad(90))))
        });

        // STEP 6: redeem 2 by customer1 and transfer to customer2
        await time.increase(5*24*3600);
        await web3tx(rdai.redeemAndTransfer, "rdai.redeem 2 of customer1 to customer2", {
            inLogs: [{
                name: "Transfer",
                args: {
                    from: customer1,
                    to: ZERO_ADDRESS,
                    value: toWad(2)
                }
            }]
        })(customer2, toWad(2), { from: customer1 });
        assert.equal(wad4human(await dai.balanceOf.call(customer2)), "2.00000");
        
        // STEP 7: transfer 10 from customer 1 to customer 3

        // some invalid tranfers
        await expectRevert(rdai.transfer(customer1, toWad(1), { from: customer1 }), "src should not equal dst");
        await expectRevert(rdai.transfer(customer2, toWad(100.1), { from: customer1 }), "Not enough balance to transfer");
        await expectRevert(rdai.transferFrom(customer1, customer2, toWad(1), { from: admin }), "Not enough allowance for transfer");

        await time.increase(5*24*3600);
        await web3tx(rdai.transfer, "rdai.transfer 10 from customer1 to customer3", {
            inLogs: [{
                name: "Transfer",
                args: {
                    from: customer1,
                    to: customer3,
                    value: toWad(10)
                }
            }]
        })(customer3, toWad(10), { from: customer1 });

        asBalanceNext = await adai.balanceOf(aaveAS.address);
        earning = asBalanceNext.sub(new BN(toWad(88)));
        
        await expectAccount(customer1, {
            tokenBalance: wad4human(earning.add(new BN(toWad(78)))),
            cumulativeInterest: wad4human(earning),
            receivedLoan: "78.00000",
            receivedSavings: wad4human(earning.add(new BN(toWad(78)))),
            interestPayable: "0.00000",
        });
        await expectAccount(customer3, {
            tokenBalance: "10.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "10.00000",
            receivedSavings: "10.00000",
            interestPayable: "0.00000",
        });
    })


    it("#3 normal operations with hat", async () => {
        // STEP 1: mint 100 to customer1
        await web3tx(dai.approve, "dai.approve 100 by customer1")(
            rdai.address, toWad(100), { from: customer1 });
        await web3tx(rdai.mintWithNewHat, "rdai.mint 100 to customer1 with a hat benefiting admin(90%) and customer2(10%)")(
            toWad(100), [admin, customer2], [90, 10], { from: customer1 });

        assert.equal(wad4human(await dai.balanceOf.call(customer1)), "900.00000");
        assert.equal(wad4human(await rdai.totalSupply.call()), "100.00000");

        assert.deepEqual(parseHat(await rdai.getHatByAddress.call(customer1)), {
            hatID: 1,
            recipients: [admin, customer2],
            proportions: [3865470565, 429496729]
        });

        assert.deepEqual(parseHat(await rdai.getHatByAddress.call(admin)), {
            hatID: 0,
            recipients: [],
            proportions: []
        });
        assert.deepEqual(parseHat(await rdai.getHatByAddress.call(customer2)), {
            hatID: 0,
            recipients: [],
            proportions: []
        });
        assert.deepEqual(parseHatStats(await rdai.getHatStats(1)), {
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
        await time.increase(5*24*3600);

        assert.equal(wad4human(await rdai.totalSupply.call()), "100.00000");
        
        asBalanceNext = await adai.balanceOf(aaveAS.address);
        earning1 = asBalanceNext.sub(new BN(toWad(100)));

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
            receivedSavings:  wad4human(earning1.muln(90).divn(100).add(new BN(toWad(90)))),
            interestPayable: wad4human(earning1.muln(90).divn(100)),
        });
        await expectAccount(customer2, {
            tokenBalance: "0.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "10.00000",
            receivedSavings: wad4human(earning1.muln(10).divn(100).add(new BN(toWad(10)))),
            interestPayable: wad4human(earning1.muln(10).divn(100)),
        });

        // STEP 3: redeem 10 to customer1
        await web3tx(rdai.redeem, "rdai.redeem 10 to customer1")(
            toWad(10), { from: customer1 });
        
        asBalanceNext = await adai.balanceOf(aaveAS.address);
        earning2 = asBalanceNext.sub(new BN(toWad(90)));
        
        assert.equal(wad4human(await dai.balanceOf.call(customer1)), "910.00000");
        assert.equal(wad4human(await rdai.totalSupply.call()), "90.00000");

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
            receivedSavings: wad4human(earning2.muln(90).divn(100).add(new BN(toWad(81)))),
            interestPayable: wad4human(earning2.muln(90).divn(100)),
        });

        await expectAccount(customer2, {
            tokenBalance: "0.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "9.00000",
            receivedSavings: wad4human(earning2.muln(10).divn(100).add(new BN(toWad(9)))),
            interestPayable: wad4human(earning2.muln(10).divn(100)),
        });

        // STEP 4: transfer 10 from customer1 to customer3
        await time.increase(5*24*3600);
        await web3tx(rdai.transfer, "rdai.transfer 10 customer1 -> customer3")(
            customer3, toWad(10), { from: customer1 });

        asBalanceNext = await adai.balanceOf(aaveAS.address);
        earning3 = asBalanceNext.sub(new BN(toWad(90)));

        assert.equal(wad4human(await rdai.totalSupply.call()), "90.00000");
        assert.deepEqual(parseHat(await rdai.getHatByAddress.call(customer3)), {
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
            receivedSavings: wad4human(earning3.muln(90).divn(100).add(new BN(toWad(81)))),
            interestPayable: wad4human(earning3.muln(90).divn(100)),
        });
        
        await expectAccount(customer2, {
            tokenBalance: "0.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "9.00000",
            receivedSavings: wad4human(earning3.muln(10).divn(100).add(new BN(toWad(9)))),
            interestPayable: wad4human(earning3.muln(10).divn(100)),
        });
        
        await expectAccount(customer3, {
            tokenBalance: "10.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "0.00000",
            receivedSavings: "0.00000",
            interestPayable: "0.00000",
        });

        // STEP 5: pay interest to admin
        await time.increase(5*24*3600);
        assert.equal(wad4human(await rdai.balanceOf(admin)), "0.00000");
        await web3tx(rdai.payInterest, "rdai.payInterest to admin")(
            admin, { from : admin });

        asBalanceNext = await adai.balanceOf(aaveAS.address);
        earning4 = asBalanceNext.sub(new BN(toWad(90)));

        await expectAccount(customer1, {
            tokenBalance: "80.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "0.00000",
            receivedSavings: "0.00000",
            interestPayable: "0.00000",
        });
        await expectAccount(admin, {
            tokenBalance: wad4human(earning4.muln(90).divn(100)),
            cumulativeInterest: wad4human(earning4.muln(90).divn(100)),
            receivedLoan: "81.00000",
            receivedSavings: wad4human(earning4.muln(90).divn(100).add(new BN(toWad(81)))),
            interestPayable: "0.00000",
        });
        await expectAccount(customer2, {
            tokenBalance: "0.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "9.00000",
            receivedSavings: wad4human(earning4.muln(10).divn(100).add(new BN(toWad(9)))),
            interestPayable: wad4human(earning4.muln(10).divn(100)),
        });
        await expectAccount(customer3, {
            tokenBalance: "10.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "0.00000",
            receivedSavings: "0.00000",
            interestPayable: "0.00000",
        });
    });

    it("#4 mint multiple times", async () => {
        await web3tx(dai.approve, "dai.approve 100 by customer1")(
            rdai.address, toWad(100), { from: customer1 });
        await web3tx(rdai.mint, "rdai.mint 10 to customer1")(
            toWad(10), { from: customer1 });
        await expectAccount(customer1, {
            tokenBalance: "10.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "10.00000",
            receivedSavings: "10.00000",
            interestPayable: "0.00000",
        });

        await web3tx(rdai.mint, "rdai.mint 5 to customer1")(
            toWad(5), { from: customer1 });
        await expectAccount(customer1, {
            tokenBalance: "15.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "15.00000",
            receivedSavings: "15.00000",
            interestPayable: "0.00000",
        });

        await doBingeBorrowing();
        await time.increase(5*24*3600);
        
        asBalanceNext = await adai.balanceOf(aaveAS.address);
        earning = asBalanceNext.sub(new BN(toWad(15)));
        
        await expectAccount(customer1, {
            tokenBalance: "15.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "15.00000",
            receivedSavings: wad4human(earning.add(new BN(toWad(15)))),
            interestPayable: wad4human(earning),
        });

        asBalanceNext = await adai.balanceOf(aaveAS.address);
        earning4 = asBalanceNext.sub(new BN(toWad(90)));

        await validateGlobalInvariants();
    });


    it("#5 redeem all including paid interest from single hat", async () => {
        // STEP 1: mint 200 -> customer1 with hat[customer1:10%, customer2:90%]
        await web3tx(dai.approve, "dai.approve 100 by customer1")(
            rdai.address, toWad(200), { from: customer1 });
        await web3tx(rdai.mintWithNewHat, "rdai.mint 200 to customer1 with a hat benefiting customer1(10%) and customer2(90%)")(
            toWad(200), [customer1, customer2], [10, 90], { from: customer1 });

        // STEP 2: transfer 100 customer1 -> customer2
        await web3tx(rdai.transfer, "rdai.transfer 100 customer1 -> customer2")(
            customer2, toWad(100), { from: customer1 });

        assert.equal(wad4human(await rdai.totalSupply.call()), "200.00000");
        assert.equal(wad4human(await dai.balanceOf.call(customer1)), "800.00000");

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
        await time.increase(5*24*3600);
        asBalanceNext = await adai.balanceOf(aaveAS.address);
        earning1 = asBalanceNext.sub(new BN(toWad(200)));

        await expectAccount(customer1, {
            tokenBalance: "100.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "20.00000",
            receivedSavings: wad4human(earning1.muln(10).divn(100).add(new BN(toWad(20)))),
            interestPayable: wad4human(earning1.muln(10).divn(100)),
        });
        await expectAccount(customer2, {
            tokenBalance: "100.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "180.00000",
            receivedSavings: wad4human(earning1.muln(90).divn(100).add(new BN(toWad(180)))),
            interestPayable: wad4human(earning1.muln(90).divn(100)),
        });

        // STEP 3: pay interest to customer2
        await time.increase(5*24*3600);
        await web3tx(rdai.payInterest, "rdai.payInterest to customer2")(
            customer2, { from : admin });
        
        asBalanceNext = await adai.balanceOf(aaveAS.address);
        earning2 = asBalanceNext.sub(new BN(toWad(200)));

        await expectAccount(customer1, {
            tokenBalance: "100.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "20.00000",
            receivedSavings: wad4human(earning2.muln(10).divn(100).add(new BN(toWad(20)))),
            interestPayable: wad4human(earning2.muln(10).divn(100)),
        });

        await expectAccount(customer2, {
            tokenBalance: wad4human(earning2.muln(90).divn(100).add(new BN(toWad(100)))),
            cumulativeInterest: wad4human(earning2.muln(90).divn(100)),
            receivedLoan: "180.00000",
            receivedSavings: wad4human(earning2.muln(90).divn(100).add(new BN(toWad(180)))),
            interestPayable: "0.00000",
        });

        assert.equal(wad4human(await rdai.totalSupply.call()), wad4human(asBalanceNext.sub(earning2.muln(10).divn(100))));

        // STEP 4: redeem tokenBalance for customer2
        const customer2RBalance = toWad(wad4human(earning2.muln(90).divn(100).add(new BN(toWad(100)))));

        await expectRevert(rdai.redeem(customer2RBalance.add(toWad("0.00001")), { from: customer2 }), "Not enough balance to redeem");
        await web3tx(rdai.redeem, "rdai.redeem "+ wad4human(earning2.muln(90).divn(100).add(new BN(toWad(100)))) +" for customer2")(
            customer2RBalance, { from: customer2 });

        
        assert.isTrue((await dai.balanceOf.call(customer2)).eq(customer2RBalance));

        previousCustomer1earning = earning2.muln(10).divn(100);
        previousCustomer2earning = earning2.muln(90).divn(100);

        asBalanceNext = await adai.balanceOf(aaveAS.address);
        earning3 = asBalanceNext.sub(new BN(toWad(100))).sub(previousCustomer1earning);

        await expectAccount(customer1, {
            tokenBalance: "100.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "10.00000",
            receivedSavings: wad4human(earning3.muln(10).divn(100).add(previousCustomer1earning).add(new BN(toWad(10)))),
            interestPayable: wad4human(earning3.muln(10).divn(100).add(previousCustomer1earning)),
        });

        await expectAccount(customer2, {
            tokenBalance: "0.00000",
            cumulativeInterest: wad4human(previousCustomer2earning),
            receivedLoan: "90.00000",
            receivedSavings: wad4human(earning3.muln(90).divn(100).add(new BN(toWad(90)))),
            interestPayable: wad4human(earning3.muln(90).divn(100)),
        });

        // Validate global stats
        await validateGlobalInvariants();
        assert.deepEqual(parseHatStats(await rdai.getHatStats(0)), {
            useCount: zeroHatUseCount(2),
            totalLoans: "0.00000",
            totalSavings: "0.00000",
        });
        assert.deepEqual(parseGlobalStats(await rdai.getGlobalStats.call()), {
            totalSupply: "100.00000",
            totalSavingsAmount: wad4human(earning3.add(previousCustomer1earning).add(new BN(toWad(100))))
        });
        assert.deepEqual(parseHatStats(await rdai.getHatStats(1)), {
            useCount: "2",
            totalLoans: "100.00000",
            totalSavings: wad4human(earning3.add(earning2).add(new BN(toWad(100)))),
        });
    });
})