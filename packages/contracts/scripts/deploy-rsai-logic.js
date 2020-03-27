module.exports = async function (callback) {
    try {
        global.web3 = web3;

        const { web3tx } = require("@decentral.ee/web3-test-helpers");
        const rSAI = artifacts.require("rSAI");
        const rSAILogic = await web3tx(rSAI.new, "rSAI.new")();
        console.log("rSAILogic deployed at: ", rSAILogic.address);

        callback();
    } catch (err) {
        callback(err);
    }
};
