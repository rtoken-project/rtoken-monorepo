const { wad4human, fromDecimals } = require("@decentral.ee/web3-test-helpers");
const getRTokenData = require("./common/getRTokenData");
const getAllEvents = require("./common/getAllEvents");

function cdai4human(wad) {
    return Number(fromDecimals(wad.toString(), 8)).toFixed(5);
}

module.exports = async function (callback) {
    try {
        global.web3 = web3;
        const network = await web3.eth.net.getNetworkType();

        const tokenName = process.argv[process.argv.length - 1];

        const RTokenData = getRTokenData(network, tokenName);
        const IRToken = artifacts.require("IRToken");
        const rtoken = await IRToken.at(RTokenData.address);

        const loanEvents = await getAllEvents(
            rtoken,
            "LoansTransferred",
            RTokenData.creationBlockNumber);

        console.log("blockNumber,txHash,owner,recipient,hatId,isDistribution,redeemableAmount,internalSavingsAmount,redeemableAmount(+h),internalSavingsAmount(+h)");
        loanEvents.forEach(e => {
            console.log([
                e.blockNumber,
                e.transactionHash,
                e.args.owner,
                e.args.recipient,
                e.args.hatId,
                e.args.isDistribution ? 1 : 0,
                e.args.redeemableAmount.toString(),
                e.args.internalSavingsAmount.toString(),
                wad4human(e.args.redeemableAmount),
                cdai4human(e.args.internalSavingsAmount)
            ].join(","));
        });

        callback();
    } catch (err) {
        callback(err);
    }
};
