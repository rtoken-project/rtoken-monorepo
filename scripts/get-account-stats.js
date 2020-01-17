const { wad4human } = require("@decentral.ee/web3-test-helpers");

module.exports = async function (callback) {
    try {
        global.web3 = web3;

        let network = await web3.eth.net.getNetworkType();
        console.log("Current network:", network);

        const RToken = artifacts.require("RToken");

        const rtokenAddress = process.argv[process.argv.length - 2];
        const owner = process.argv[process.argv.length - 1];

        console.debug("rToken address", rtokenAddress);
        console.debug("owner address", rtokenAddress);
        const rToken = await RToken.at(rtokenAddress);
        const receivedSavingsOf = await rToken.receivedSavingsOf.call(owner);
        console.log(wad4human(receivedSavingsOf));

        callback();
    } catch (err) {
        callback(err);
    }
};
