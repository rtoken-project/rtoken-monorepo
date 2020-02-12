const { wad4human, fromDecimals } = require("@decentral.ee/web3-test-helpers");
const getRTokenData = require("./common/getRTokenData");
const getAllEvents = require("./common/getAllEvents");
const analyizeAccounts = require("./common/analyizeAccounts");

function cdai4human(wad) {
    return Number(fromDecimals(wad.toString(), 8)).toFixed(5);
}

module.exports = async function (callback) {
    try {
        global.web3 = web3;
        const toBN = web3.utils.toBN;
        const network = await web3.eth.net.getNetworkType();

        const IRToken = artifacts.require("IRToken");

        const tokenName = process.argv[process.argv.length - 1];

        const RTokenData = getRTokenData(network, tokenName);
        const rtoken = await IRToken.at(RTokenData.address);

        const loanEvents = await getAllEvents(
            rtoken,
            "LoansTransferred",
            RTokenData.creationBlockNumber);
        const accounts = analyizeAccounts(loanEvents);

        console.log("owner,hatID, lRecipientsSum(sum),lDebt(sum),sInternalAmount(sum),rAmount,rInterest,lRecipientsSum,lDebt,sInternalAmount,error1(lRecipientsSum),error2(lDebt),error3(sInternalAmount),error(rAmount)");
        await Promise.all(
            Object.keys(accounts).map(async owner => {
                const lRecipients = accounts[owner].lRecipients;
                const lDebt = accounts[owner].lDebt;
                const sInternalAmount = accounts[owner].sInternalAmount;
                const lRecipientsSum = Object.values(lRecipients)
                    .reduce((acc, cur) => acc.add(cur), toBN(0));
                const accountStats = await rtoken.getAccountStats.call(owner);
                console.log([
                    owner,
                    accountStats.hatID.toString(),
                    wad4human(lRecipientsSum),
                    wad4human(lDebt),
                    wad4human(sInternalAmount),
                    wad4human(toBN(accountStats.rAmount)),
                    wad4human(toBN(accountStats.rInterest)),
                    wad4human(toBN(accountStats.lRecipientsSum)),
                    wad4human(toBN(accountStats.lDebt)),
                    cdai4human(toBN(accountStats.sInternalAmount)),
                    // error(lRecipientsSum)
                    toBN(accountStats.lRecipientsSum)
                        .sub(lRecipientsSum)
                        .toString(),
                    // error(lDebt)
                    toBN(accountStats.lDebt)
                        .sub(lDebt)
                        .toString(),
                    // error(sInternalAmount)
                    toBN(accountStats.sInternalAmount)
                        .sub(sInternalAmount)
                        .toString(),
                    // error(rAmount)
                    toBN(accountStats.rAmount)
                        .sub(
                            toBN(accountStats.lRecipientsSum)
                                .add(
                                    toBN(accountStats.rInterest)
                                )
                        )
                        .toString()
                ].join(","));
            })
        );

        callback();
    } catch (err) {
        callback(err);
    }
};
