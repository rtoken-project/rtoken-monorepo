module.exports = function(deployer, network) {deployer.then(async () => {
    console.log("Current network:", network);

    global.web3 = web3;
    const { web3tx } = require("@decentral.ee/web3-test-helpers");
    const CompoundSavingStrategy = artifacts.require("CompoundSavingStrategy");
    const RToken = artifacts.require("RToken");

    if (network === "rinkeby") {
        // Contract addresses: https://compound.finance/developers#enter-markets
        const cDAIAddress = "0x6d7f0754ffeb405d23c51ce938289d4835be3b14";
        const compoundSS = await web3tx(CompoundSavingStrategy.new, `CompoundSavingStrategy.new cDAI ${cDAIAddress}`)(
            cDAIAddress
        );
        const rToken = await web3tx(RToken.new, `RToken.new savingStrategy ${compoundSS.address}`)(
            compoundSS.address
        );
        console.log("rToken deployed at: ", rToken.address);
    }
});};
