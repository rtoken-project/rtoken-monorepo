module.exports = function(deployer, network) {deployer.then(async () => {
    console.log("Current network:", network);

    global.web3 = web3;
    const { web3tx } = require("@decentral.ee/web3-test-helpers");
    const CompoundAllocationStrategy = artifacts.require("CompoundAllocationStrategy");
    const RToken = artifacts.require("RToken");

    let cDAIAddress;
    if (network === "rinkeby") {
        // Contract addresses: https://compound.finance/developers#enter-markets
        cDAIAddress = "0x6d7f0754ffeb405d23c51ce938289d4835be3b14";
    } else if (network === "kovan") {
        cDAIAddress = "0x0a1e4d0b5c71b955c0a5993023fc48ba6e380496";
    }
    if (cDAIAddress) {
        const compoundAS = await web3tx(CompoundAllocationStrategy.new, `CompoundAllocationStrategy.new cDAI ${cDAIAddress}`)(
            cDAIAddress
        );
        const rToken = await web3tx(RToken.new, `RToken.new allocationStrategy ${compoundAS.address}`)(
            compoundAS.address
        );
        console.log("rToken deployed at: ", rToken.address);
    }
});};
