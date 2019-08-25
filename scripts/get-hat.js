module.exports = async function (callback) {
    try {
        global.web3 = web3;

        let network = await web3.eth.net.getNetworkType();
        console.log("Current network:", network);

        const RToken = artifacts.require("RToken");

        const rToken = await RToken.at(process.argv[6]);
        console.log("rToken address", rToken.address);
        const owner = process.argv[7];
        const hat = await rToken.getHatByAddress.call(owner);
        console.log(`hat of ${owner}`, {
            hatID: hat.hatID.toString(),
            recipients: hat.recipients,
            proportions: hat.proportions.map(i=>i.toString())
        });

        callback();
    } catch (err) {
        callback(err);
    }
};
