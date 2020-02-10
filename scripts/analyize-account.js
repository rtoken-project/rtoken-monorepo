const { wad4human } = require("@decentral.ee/web3-test-helpers");
const getRTokenData = require("./common/getRTokenData");
const getAllEvents = require("./common/getAllEvents");
const analyizeAccounts = require("./common/analyizeAccounts");

function parseAccountStats({
    hatID,
    rAmount,
    rInterest,
    lDebt,
    sInternalAmount,
    rInterestPayable,
    cumulativeInterest,
    lRecipientsSum
}) { return {
    hatID,
    rAmount,
    rInterest,
    lDebt,
    sInternalAmount,
    rInterestPayable,
    cumulativeInterest,
    lRecipientsSum
}; }

module.exports = async function (callback) {
    try {
        global.web3 = web3;
        const toBN = web3.utils.toBN;

        const network = await web3.eth.net.getNetworkType();

        const IRToken = artifacts.require("IRToken");

        const tokenName = process.argv[process.argv.length - 2];
        const owner = process.argv[process.argv.length - 1];

        const RTokenData = getRTokenData(network, tokenName);
        console.debug("rToken address", RTokenData.address);
        console.debug("owner address", owner);

        const rtoken = await IRToken.at(RTokenData.address);

        const loanEvents = await getAllEvents(
            rtoken,
            "LoansTransferred",
            RTokenData.creationBlockNumber);
        const accounts = analyizeAccounts(loanEvents);

        const accountStats = await rtoken.getAccountStats.call(owner);
        console.log("account stats", parseAccountStats(accountStats));

        const lRecipients = accounts[owner].lRecipients;
        const lDebt = accounts[owner].lDebt;
        const sInternalAmount = accounts[owner].sInternalAmount;
        const lRecipientsSum = Object.values(lRecipients)
            .reduce((acc, cur) => acc.add(cur), toBN(0));
        console.log("account stats(reconstructed)", {
            lDebt: lDebt.toString(),
            sInternalAmount: sInternalAmount.toString(),
            lRecipientsSum: lRecipientsSum.toString(),
        });

        Object.keys(accounts).forEach(a => {
            const account = accounts[a];
            const lRecipient = account.lRecipients[owner];
            if (lRecipient) {
                const v = toBN(lRecipient);
                console.log(`${a} -> ${wad4human(v)} ${v}`);
            }
        });

        const account = accounts[owner];
        Object.keys(account.lRecipients).forEach(r => {
            const v = account.lRecipients[r];
            console.log(`-> ${r} ${wad4human(v)} ${v}`);
        });

        callback();
    } catch (err) {
        callback(err);
    }
};
