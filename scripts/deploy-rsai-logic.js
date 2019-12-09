module.exports = async function (callback) {
    try {
        global.web3 = web3;

        let network = await web3.eth.net.getNetworkType();
        console.log("Current network:", network);

        const { web3tx } = require("@decentral.ee/web3-test-helpers");
        const rSAI = artifacts.require("rSAI");
        const rSAILogic = await web3tx(rSAI.new, "rSAI.new")(
            {
                gas: 5000000,
            }
        );
        console.log("rSAILogic deployed at: ", rSAILogic.address);

        callback();
    } catch (err) {
        callback(err);
    }
};
