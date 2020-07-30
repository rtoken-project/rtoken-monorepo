const ERC20Mintable = artifacts.require("ERC20Mintable");
const CErc20 = artifacts.require("CErc20");
const ComptrollerMock = artifacts.require("ComptrollerMock");
const InterestRateModelMock = artifacts.require("InterestRateModelMock");
const CompoundAllocationStrategy = artifacts.require(
    "CompoundAllocationStrategy"
);
const RToken = artifacts.require("RToken");
const Proxy = artifacts.require("Proxy");
const {time} = require("openzeppelin-test-helpers");
const {web3tx, wad4human, toWad} = require("@decentral.ee/web3-test-helpers");

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

    async function createCompoundAllocationStrategy(cTokenExchangeRate) {
        const comptroller = await web3tx(
            ComptrollerMock.new,
            "ComptrollerMock.new"
        )({from: admin});
        const interestRateModel = await web3tx(
            InterestRateModelMock.new,
            "InterestRateModelMock.new"
        )({from: admin});
        const cToken = await web3tx(CErc20.new, "CErc20.new")(
            token.address,
            comptroller.address,
            interestRateModel.address,
            cTokenExchangeRate, // 1 cToken == cTokenExchangeRate * token
            "Compound token",
            "cToken",
            18,
            {
                from: admin
            }
        );
        const compoundAS = await web3tx(
            CompoundAllocationStrategy.new,
            "CompoundAllocationStrategy.new"
        )(cToken.address, {
            from: admin
        });
        return {cToken, compoundAS};
    }

    before(async () => {
        token = await web3tx(
            ERC20Mintable.new,
            "ERC20Mintable.new"
        )({
            from: admin
        });
        await web3tx(token.mint, "token.mint 1000 -> customer1")(
            customer1,
            toWad(1000),
            {from: admin}
        );
        await web3tx(token.mint, "token.mint 1000 -> customer2")(
            customer2,
            toWad(1000),
            {from: admin}
        );
        await web3tx(token.mint, "token.mint 1000 -> customer4")(
            customer4,
            toWad(1000),
            {from: admin}
        );

        {
            const result = await createCompoundAllocationStrategy(toWad(0.1));
            cToken = result.cToken;
            compoundAS = result.compoundAS;
        }

        // Deploy the rToken logic/library contract
        rTokenLogic = await web3tx(
            RToken.new,
            "RToken.new"
        )({
            from: admin
        });
        // Get the init code for rToken
        const rTokenConstructCode = rTokenLogic.contract.methods
            .initialize(compoundAS.address, "RToken Test", "RTOKEN", 18)
            .encodeABI();

        // Deploy the Proxy, using the init code for rToken
        const proxy = await web3tx(Proxy.new, "Proxy.new")(
            rTokenConstructCode,
            rTokenLogic.address,
            {
                from: admin
            }
        );
        // Create the rToken object using the proxy address
        rToken = await RToken.at(proxy.address);

        await web3tx(
            compoundAS.transferOwnership,
            "compoundAS.transferOwnership"
        )(rToken.address);
        console.log("=============================\n");
        console.log("admin is", admin);
        console.log("bingeBorrower is", bingeBorrower);
        console.log("customer1 is", customer1);
        console.log("customer2 is", customer2);
        console.log("customer3 is", customer3);
        console.log(
            `The rTOKEN contract (proxy) is deployed at: ${proxy.address}`
        );
        console.log(`The compoundAS is deployed at: ${compoundAS.address}`);
        console.log("=============================");
    });

    // Test helpers
    async function doBingeBorrowing(nBlocks = 100) {
        // this process should generate 0.0001% * nBlocks amount of tokens worth of interest
        // when nBlocks = 100, it is 0.001

        console.log(
            `Before binge borrowing: 1 cToken = ${wad4human(
                await cToken.exchangeRateStored.call()
            )} Token`
        );
        // for testing purpose, our mock doesn't even check if there is
        // sufficient collateral in the system!!
        const borrowAmount = toWad(10);
        await web3tx(cToken.borrow, "cToken.borrow 10 to bingeBorrower", {
            inLogs: [
                {
                    name: "Borrow"
                }
            ]
        })(borrowAmount, {
            from: bingeBorrower
        });
        await waitForInterest(nBlocks);
        console.log(
            `After binge borrowing: 1 cToken = ${wad4human(
                await cToken.exchangeRateStored.call()
            )} Token`
        );
    }

    async function waitForInterest(nBlocks = 100) {
        console.log(`Wait for ${nBlocks} blocks...`);
        while (--nBlocks) await time.advanceBlock();
        await web3tx(
            cToken.accrueInterest,
            "cToken.accrueInterest"
        )({
            from: admin
        });
    }

    async function expectAccount(account, balances, decimals) {
        let accountName;
        if (account === admin) accountName = "admin";
        else if (account === customer1) accountName = "customer1";
        else if (account === customer2) accountName = "customer2";
        else if (account === customer3) accountName = "customer3";
        else if (account === customer4) accountName = "customer4";

        const tokenBalance = wad4human(
            await rToken.balanceOf.call(account),
            decimals
        );
        console.log(
            `${accountName} tokenBalance ${tokenBalance} expected ${balances.tokenBalance}`
        );
        assert.equal(
            tokenBalance,
            balances.tokenBalance,
            `${accountName} tokenBalance`
        );

        const receivedLoan = wad4human(
            await rToken.receivedLoanOf.call(account),
            decimals
        );
        console.log(
            `${accountName} receivedLoan ${receivedLoan} expected ${balances.receivedLoan}`
        );
        assert.equal(
            receivedLoan,
            balances.receivedLoan,
            `${accountName} receivedLoan`
        );

        const receivedSavings = wad4human(
            await rToken.receivedSavingsOf.call(account),
            decimals
        );
        console.log(
            `${accountName} receivedSavings ${receivedSavings} expected ${balances.receivedSavings}`
        );
        assert.equal(
            receivedSavings,
            balances.receivedSavings,
            `${accountName} receivedSavings`
        );

        const interestPayable = wad4human(
            await rToken.interestPayableOf.call(account),
            decimals
        );
        console.log(
            `${accountName} interestPayable ${interestPayable} expected ${balances.interestPayable}`
        );
        assert.equal(
            interestPayable,
            balances.interestPayable,
            `${accountName} interestPayable`
        );

        const accountStats = await rToken.getAccountStats.call(account);

        const cumulativeInterest = wad4human(
            accountStats.cumulativeInterest,
            decimals
        );
        console.log(
            `${accountName} cumulativeInterest ${cumulativeInterest} expected ${balances.cumulativeInterest}`
        );
        assert.equal(
            cumulativeInterest,
            balances.cumulativeInterest,
            `${accountName} cumulativeInterest`
        );
    }

    function parseHat({hatID, recipients, proportions}) {
        const hatObj = {
            recipients: recipients,
            proportions: proportions.map(i => i.toNumber())
        };
        if (typeof hatID !== "undefined") {
            hatObj.hatID = hatID.toNumber();
        }
        return hatObj;
    }
    // rDAI helpers
    async function mint(customer, amount) {
        await web3tx(
            token.approve,
            `token.approve ${amount} by ${customer}`
        )(rToken.address, toWad(amount), {from: customer});
        await web3tx(rToken.mint, `rToken.mint ${amount} to ${customer}`, {
            inLogs: [
                {
                    name: "Transfer",
                    args: {
                        from: ZERO_ADDRESS,
                        to: customer,
                        value: toWad(amount)
                    }
                }
            ]
        })(toWad(amount), {
            from: customer
        });
    }

    async function redeem(customer, amount) {
        await web3tx(rToken.redeem, `rToken.redeem ${amount} by ${customer}`, {
            inLogs: [
                {
                    name: "Transfer",
                    args: {
                        from: customer,
                        to: ZERO_ADDRESS,
                        value: toWad(amount)
                    }
                }
            ]
        })(toWad(amount), {from: customer});
    }

    async function redeemAll(customer) {
        await web3tx(
            rToken.redeemAll,
            `rToken.redeem all for ${customer}`
        )({from: customer});
    }

    it("#1 Customer 1 earns interest with zero hat", async () => {
        await mint(customer1, 100);
        assert.equal(
            wad4human(await token.balanceOf.call(customer1)),
            "900.00000"
        );
        assert.equal(
            wad4human(await rToken.balanceOf.call(customer1)),
            "100.00000"
        );
        await expectAccount(customer1, {
            tokenBalance: "100.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "100.00000",
            totalLoans: "100.00000",
            totalSavings: "100.00000",
            receivedSavings: "100.00000",
            interestPayable: "0.00000"
        });
        await doBingeBorrowing();
        await expectAccount(customer1, {
            tokenBalance: "100.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "100.00000",
            receivedSavings: "100.00100",
            interestPayable: "0.00100"
        });
        await redeemAll(customer1);
    });
    it("#2 Customer2 sends interest to customer3", async () => {
        await web3tx(
            token.approve,
            "token.approve 100 by customer2"
        )(rToken.address, toWad(100), {from: customer2});
        await web3tx(
            rToken.mintWithNewHat,
            "rToken.mint 100 to customer2 with a hat benefiting customer3(100%)"
        )(toWad(100), [customer3], [1], {from: customer2});
        assert.equal(
            wad4human(await token.balanceOf.call(customer2)),
            "900.00000"
        );
        assert.equal(
            wad4human(await rToken.balanceOf.call(customer2)),
            "100.00000"
        );
        assert.equal(
            wad4human(await rToken.balanceOf.call(customer3)),
            "0.00000"
        );
        await doBingeBorrowing();
        await expectAccount(customer3, {
            tokenBalance: "0.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "100.00000",
            receivedSavings: "100.00101",
            interestPayable: "0.00101"
        });
    });
    it("#3 Customer2 stops sending interest to customer3", async () => {
        await redeemAll(customer2);
        await expectAccount(customer3, {
            tokenBalance: "0.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "0.00000",
            receivedSavings: "0.00102",
            interestPayable: "0.00102"
        });
    });
    it("#4 Customer4 sends interest to customer3", async () => {
        // Prevent customer3 from earning on their own cDAI stash
        await redeemAll(customer3);

        await web3tx(
            token.approve,
            "token.approve 100 by customer4"
        )(rToken.address, toWad(100), {from: customer4});
        await web3tx(
            rToken.mintWithNewHat,
            "rToken.mint 100 to customer4 with a hat benefiting customer3(100%)"
        )(toWad(100), [customer3], [1], {from: customer4});
        await doBingeBorrowing();
        await expectAccount(customer3, {
            tokenBalance: "0.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "100.00000",
            receivedSavings: "100.00102",
            interestPayable: "0.00102"
        });
    });
    it("#5 Customer3 redeems all interest earned so far", async () => {
        await redeemAll(customer3);
        assert.equal(
            wad4human(await token.balanceOf.call(customer3)),
            "0.00204"
        );
        await expectAccount(customer3, {
            tokenBalance: "0.00000",
            cumulativeInterest: "0.00000",
            receivedLoan: "0.00000",
            receivedSavings: "0.00000",
            interestPayable: "0.00000"
        });
    });
    // So far totals sent to customer3
    // customer2 sent 0.00102
    // customer4 sent 0.00102

    // it("#4 Customer4 starts sending interest to customer3", async () => {
    //     await expectAccount(customer1, {
    //         tokenBalance: "100.00000",
    //         cumulativeInterest: "0.00000",
    //         receivedLoan: "100.00000",
    //         receivedSavings: "100.00204",
    //         interestPayable: "0.00204"
    //     });
    //     await web3tx(
    //         rToken.changeHat,
    //         "rToken changeHat for customer1 to hatID #1"
    //     )(1, {from: customer1});
    //     await expectAccount(customer1, {
    //         tokenBalance: "100.00000",
    //         cumulativeInterest: "0.00000",
    //         receivedLoan: "0.00000",
    //         receivedSavings: "0.00204",
    //         interestPayable: "0.00204"
    //     });
    //     await expectAccount(customer3, {
    //         tokenBalance: "0.00000",
    //         cumulativeInterest: "0.00000",
    //         receivedLoan: "100.00000",
    //         receivedSavings: "100.00102",
    //         interestPayable: "0.00102"
    //     });
    //     await doBingeBorrowing();
    //     await expectAccount(customer3, {
    //         tokenBalance: "0.00000",
    //         cumulativeInterest: "0.00000",
    //         receivedLoan: "100.00000",
    //         receivedSavings: "100.00407",
    //         interestPayable: "0.00407"
    //     });
    // });
});
