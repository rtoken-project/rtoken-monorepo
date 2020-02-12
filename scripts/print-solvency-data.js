const { wad4human } = require("@decentral.ee/web3-test-helpers");
const addresses = require("./common/addresses");
const getAllEvents = require("./common/getAllEvents");

const SECONDS_PER_DAY = 3600 * 24;
const AVG_SECONDS_PER_BLOCK = 13;
const AVG_NUM_BLOCKS_PER_DAY = Math.floor(SECONDS_PER_DAY / AVG_SECONDS_PER_BLOCK);

let IAllocationStrategy, IRToken, rtoken;
const allocaionStrategies = {};

function listAccounts(loanEvents, untilBlockNumber) {
    const accounts = {};
    loanEvents.forEach(e => {
        if (untilBlockNumber && e.blockNumber > untilBlockNumber) {
            return;
        }
        accounts[e.args.owner] = 1;
        accounts[e.args.recipient] = 1;
    });
    return Object.keys(accounts);
}

async function getData(loanEvents, blockNumber) {
    const toBN = web3.utils.toBN;
    const block = await web3.eth.getBlock(blockNumber);
    const timestamp = block.timestamp;

    // total non realtime supply
    const totalSupply = await rtoken.totalSupply.call(blockNumber);

    const savingStrategyAddress = await rtoken.getCurrentSavingStrategy.call(blockNumber);
    if (!(savingStrategyAddress in allocaionStrategies)) {
        allocaionStrategies[savingStrategyAddress] = await IAllocationStrategy.at(savingStrategyAddress);
    }
    const allocaionStrategy = allocaionStrategies[savingStrategyAddress];
    const savingAssetBalance = await rtoken.getSavingAssetBalance.call(blockNumber);

    const savingExchangeRate = await allocaionStrategy.exchangeRateStored.call(blockNumber);
    const savingsValue = new web3.utils.BN(savingAssetBalance.sOriginalAmount)
        .mul(new web3.utils.BN(savingExchangeRate))
        .div(new web3.utils.BN("1"+"0".repeat(18)));

    // total realtime supply
    const accounts = listAccounts(loanEvents, blockNumber);
    const accountsStats = await Promise.all(accounts.map(async owner => {
        const accountStats = await rtoken.getAccountStats.call(owner);
        return accountStats;
    }));
    const lRecipientsSumTotal = accountsStats
        .reduce((acc, stats) => acc.add(toBN(stats.lRecipientsSum)), toBN(0));
    const lDebtTotal = accountsStats
        .reduce((acc, stats) => acc.add(toBN(stats.lDebt)), toBN(0));
    const rInterestTotal = accountsStats
        .reduce((acc, stats) => acc.add(toBN(stats.rInterest)), toBN(0));
    const sInternalTotal = accountsStats
        .reduce((acc, stats) => acc.add(toBN(stats.sInternalAmount)), toBN(0));
    const savingsTotal = sInternalTotal
        .mul(new web3.utils.BN(savingExchangeRate))
        .div(new web3.utils.BN("1"+"0".repeat(18)));

    const payableInterestsTotal = savingsTotal.sub(lDebtTotal).sub(rInterestTotal);
    const savingsDeficit = savingsValue.sub(savingsTotal);
    const supplyDeficit = savingsValue.sub(totalSupply.add(payableInterestsTotal));

    return {
        block,
        timestamp,
        totalSupply,
        savingsValue,
        savingsDeficit,
        allocaionStrategyAddress: allocaionStrategy.address,
        lRecipientsSumTotal,
        lDebtTotal,
        rInterestTotal,
        payableInterestsTotal,
        supplyDeficit,
    };
}

async function printData(data) {
    console.log([
        new Date(data.timestamp * 1000).toISOString(),
        data.block.number,
        data.timestamp,
        wad4human(data.totalSupply),
        wad4human(data.savingsValue),
        wad4human(data.savingsDeficit),
        data.allocaionStrategyAddress,
        wad4human(data.lRecipientsSumTotal),
        wad4human(data.lDebtTotal),
        wad4human(data.rInterestTotal),
        wad4human(data.payableInterestsTotal),
        wad4human(data.supplyDeficit),
    ].join(","));
}

module.exports = async function (callback) {
    try {
        global.web3 = web3;
        const network = await web3.eth.net.getNetworkType();

        const cmd = process.argv[process.argv.length - 2];
        const tokenName = process.argv[process.argv.length - 1];

        const RTokenData = addresses[network][tokenName];

        IAllocationStrategy = artifacts.require("IAllocationStrategy");
        IRToken = artifacts.require("IRToken");
        rtoken = await IRToken.at(RTokenData.address);
        const currentBlock = await web3.eth.getBlock("latest");

        const loanEvents = await getAllEvents(
            rtoken,
            "LoansTransferred",
            RTokenData.creationBlockNumber);

        console.log([
            "date",
            "blocknumber",
            "timestamp",
            "totalSupply",
            "savingsValue",
            "savingsDeficit",
            "allocaionStrategy",
            "lRecipientsSumTotal",
            "lDebtTotal",
            "rInterestTotal",
            "payableInterestsTotal",
            "supplyDeficit",
        ].join(","));
        if (cmd === "all") {
            const startingBlock = await web3.eth.getBlock(RTokenData.creationBlockNumber + AVG_NUM_BLOCKS_PER_DAY);
            let expectedBlockTimestamp = startingBlock.timestamp;
            let blocksPerDay = AVG_NUM_BLOCKS_PER_DAY;
            for (let i = startingBlock.number; i <= currentBlock.number; i += blocksPerDay) {
                const data = await getData(loanEvents, i);
                // adjust blocks per day rate
                const blocksRateAdjustment = -Math.floor(
                    blocksPerDay * 0.5 *
                    (data.block.timestamp - expectedBlockTimestamp) / SECONDS_PER_DAY
                );
                //console.debug("blocksPerDay", data.block.timestamp - expectedBlockTimestamp, blocksRateAdjustment, blocksPerDay);
                await printData(data);
                blocksPerDay += blocksRateAdjustment;
                expectedBlockTimestamp += SECONDS_PER_DAY;
            }
        } else if (cmd === "new") {
            const data = await getData(loanEvents, currentBlock.number);
            await printData(data);
        }

        callback();
    } catch (err) {
        callback(err);
    }
};
