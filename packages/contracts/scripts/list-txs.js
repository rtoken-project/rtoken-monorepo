const { wad4human, fromDecimals } = require("@decentral.ee/web3-test-helpers");
const getRTokenData = require("./common/getRTokenData");
const getAllEvents = require("./common/getAllEvents");

function cdai4human(wad) {
    return Number(fromDecimals(wad.toString(), 8)).toFixed(5);
}

function decodeMethodName(methodId) {
    switch (methodId) {
    case "0xa0712d68": return "mint";
    case "0xb5dbfc1a": return "mintWithNewHat";
    case "0x388c0b8c": return "mintWithSelectedHat";
    case "0xa9059cbb": return "transfer";
    case "0x2f4350c2": return "redeemAll";
    case "0xdb006a75": return "redeem";
    case "0x2f2ba814": return "changeHat";
    case "0x5cde5055": return "createHat";
    case "0xbfe07da6": return "deposit(aragon)";
    case "0xdf133bca": return "vote(aragon)";
    default: return methodId;
    }
}

function analyizeTxs(loanEvents) {
    const txs = {};
    const toBN = web3.utils.toBN;
    loanEvents.forEach(e => {
        const txHash = e.transactionHash;
        if (!(txHash in txs)) {
            txs[txHash] = {
                hatId: e.args.hatId.toString(),
                blockNumber: e.blockNumber,
                redeemableAmount: toBN(0),
                internalSavingsAmount: toBN(0),
            };
        }
        const tx = txs[txHash];
        const redeemableAmount = toBN(e.args.redeemableAmount);
        const sInternalAmount = toBN(e.args.internalSavingsAmount);
        if (e.args.hatId.toString() !== tx.hatId) {
            tx.hatChanged = true;
        }
        if (e.args.isDistribution) {
            tx.redeemableAmount = tx.redeemableAmount.add(redeemableAmount);
            tx.internalSavingsAmount = tx.internalSavingsAmount.add(sInternalAmount);
        } else {
            tx.redeemableAmount = tx.redeemableAmount.sub(redeemableAmount);
            tx.internalSavingsAmount = tx.internalSavingsAmount.sub(sInternalAmount);
        }
    });
    return txs;
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

        const txs = analyizeTxs(loanEvents);

        console.log("blockNumber,txHash,method,hatChanged,redeemableAmount,internalSavingsAmount,redeemableAmount(+h),internalSavingsAmount(+h)");
        const promises = Object.keys(txs).map(async txHash => {
            const tx = txs[txHash];
            const txData = await web3.eth.getTransaction(txHash);
            const methodId = txData.input.slice(0, 10);
            console.log([
                tx.blockNumber,
                txHash,
                decodeMethodName(methodId),
                tx.hatChanged,
                tx.redeemableAmount.toString(),
                tx.internalSavingsAmount.toString(),
                wad4human(tx.redeemableAmount),
                cdai4human(tx.internalSavingsAmount),
                tx.hatSwitched
            ].join(","));
        });
        await Promise.all(promises);

        callback();
    } catch (err) {
        callback(err);
    }
};
