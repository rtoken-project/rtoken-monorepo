module.exports = async function (callback) {
    try {
        global.web3 = web3;

        let network = await web3.eth.net.getNetworkType();
        console.log("Current network:", network);

        const IRTokenAdmin = artifacts.require("IRTokenAdmin");

        const admin = await IRTokenAdmin.at(process.argv[6]);
        console.log("admin.owner address", await admin.owner.call());

        callback();
    } catch (err) {
        callback(err);
    }
};
