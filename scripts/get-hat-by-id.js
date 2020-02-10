function parseHat(hat) {
    return {
        recipients: hat.recipients,
        proportions: hat.proportions.map(i=>i.toString())
    };
}

module.exports = async function (callback) {
    try {
        global.web3 = web3;

        const RToken = artifacts.require("RToken");

        const rtokenAddress = process.argv[process.argv.length - 2];
        const hatID = process.argv[process.argv.length - 1];

        const rToken = await RToken.at(rtokenAddress);
        console.log("rToken address", rToken.address);
        const hat = await rToken.getHatByID.call(hatID);
        console.log(`Hat ${hatID}`, parseHat(hat));

        callback();
    } catch (err) {
        callback(err);
    }
};
