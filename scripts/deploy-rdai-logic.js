module.exports = async function (callback) {
    try {
        const { web3tx } = require("@decentral.ee/web3-test-helpers");

        global.web3 = web3;

        const RToken = artifacts.require("rDAI");
        const rDaiLogic = await web3tx(RToken.new, "RToken.new")();
        console.log("rDaiLogic deployed at: ", rDaiLogic.address);

        callback();
    } catch (err) {
        callback(err);
    }
};
