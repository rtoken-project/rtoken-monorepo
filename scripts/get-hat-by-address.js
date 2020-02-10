function parseHat(hat) {
    return {
        hatID: hat.hatID.toString(),
        recipients: hat.recipients,
        proportions: hat.proportions.map(i=>i.toString())
    };
}

module.exports = async function (callback) {
    try {
        global.web3 = web3;

        const RToken = artifacts.require("RToken");

        const rtokenAddress = process.argv[process.argv.length - 2];
        const owner = process.argv[process.argv.length - 1];

        const rToken = await RToken.at(rtokenAddress);
        console.log("rToken address", rToken.address);
        const hat = await rToken.getHatByAddress.call(owner);
        console.log(`hat of ${owner}`, parseHat(hat));

        callback();
    } catch (err) {
        callback(err);
    }
};
