const { wad4human } = require("@decentral.ee/web3-test-helpers");

const SECONDS_PER_DAY = 3600 * 24;
const AVG_SECONDS_PER_BLOCK = 13;
const AVG_NUM_BLOCKS_PER_DAY = Math.floor(SECONDS_PER_DAY / AVG_SECONDS_PER_BLOCK);

const RTOKENS = {
    rSAI: {
        address: "0xea8b224edd3e342deb514c4176c2e72bcce6fff9",
        creationBlockNumber: 8764716,
    },

    rDAI: {
        address: "0x261b45D85cCFeAbb11F022eBa346ee8D1cd488c0",
        creationBlockNumber: 9117143,
    }
};

let IAllocationStrategy, IRToken, rtoken;

async function getData(blockNumber) {
    const block = await web3.eth.getBlock(blockNumber);
    const allocaionStrategy = await IAllocationStrategy.at(
        await rtoken.getCurrentSavingStrategy.call(blockNumber)
    );
    const savingAssetBalance = await rtoken.getSavingAssetBalance.call(blockNumber);
    const totalSupply = await rtoken.totalSupply.call(blockNumber);
    const timestamp = block.timestamp;
    const savingExchangeRate = await allocaionStrategy.exchangeRateStored.call(blockNumber);
    const savingsValue = new web3.utils.BN(savingAssetBalance.sOriginalAmount).mul(new web3.utils.BN(savingExchangeRate)).div(new web3.utils.BN("1"+"0".repeat(18)));
    return {
        block,
        timestamp,
        totalSupply,
        savingsValue,
        surplus: savingsValue.sub(totalSupply),
        allocaionStrategyAddress: allocaionStrategy.address,
    };
}

async function printData(data) {
    console.log(`${new Date(data.timestamp * 1000).toISOString()}, ${data.block.number}, ${data.timestamp}, ${wad4human(data.totalSupply)}, ${wad4human(data.savingsValue)}, ${wad4human(data.surplus)}, ${data.allocaionStrategyAddress}`);
}

module.exports = async function (callback) {
    try {
        global.web3 = web3;

        const cmd = process.argv[process.argv.length - 2];
        const token = process.argv[process.argv.length - 1];

        const RTokenData = RTOKENS[token];

        IAllocationStrategy = artifacts.require("IAllocationStrategy");
        IRToken = artifacts.require("IRToken");
        rtoken = await IRToken.at(RTokenData.address);

        const currentBlock = await web3.eth.getBlock("latest");

        if (cmd === "all") {
            console.log("date,blocknumber,timestamp,totalSupply,savingsValue,surplus,allocaionStrategy");
            const startingBlock = await web3.eth.getBlock(RTokenData.creationBlockNumber + AVG_NUM_BLOCKS_PER_DAY);
            let expectedBlockTimestamp = startingBlock.timestamp;
            let blocksPerDay = AVG_NUM_BLOCKS_PER_DAY;
            for (let i = startingBlock.number; i <= currentBlock.number; i += blocksPerDay) {
                const data = await getData(i);
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
            const data = await getData(currentBlock.number);
            await printData(data);
        }

        callback();       
    } catch (err) {
        callback(err);
    }   
};

