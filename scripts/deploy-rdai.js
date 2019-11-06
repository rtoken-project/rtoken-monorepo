module.exports = async function (callback) {
    try {
        global.web3 = web3;

        let network = await web3.eth.net.getNetworkType();
        console.log("Current network:", network);

        const { web3tx } = require("@decentral.ee/web3-test-helpers");
        const CompoundAllocationStrategy = artifacts.require("CompoundAllocationStrategy");
        const RToken = artifacts.require("RToken");
        const Proxy = artifacts.require("Proxy");

        const addresses = await require("./addresses")[network];

        const compoundAS = await web3tx(
            CompoundAllocationStrategy.new,
            `CompoundAllocationStrategy.new cDAI ${addresses}`)(
            addresses.cDAI, {
                gas: 1000000,
            }
        );
        //const compoundAS = { address: "0xF07d4967ae1F600144b25f40f655f61De2A9c0Ad" };
        console.log("compoundAllocationStrategy deployed at: ", compoundAS.address);

        const rDaiLogic = await web3tx(RToken.new, "RToken.new")(
            {
                gas: 5000000,
            }
        );
        console.log("rDaiLogic deployed at: ", rDaiLogic.address);

        const rDaiConstructCode = rDaiLogic.contract.methods.initialize(
            compoundAS.address,
            "Redeemable DAI",
            "rDAI",
            18).encodeABI();
        console.log(`rDaiConstructCode rDaiLogic.initialize(${rDaiConstructCode})`);
        const proxy = await web3tx(Proxy.new, "Proxy.new")(
            rDaiConstructCode, rDaiLogic.address, {
                gas: 1000000,
            }
        );
        console.log("proxy deployed at: ", proxy.address);

        console.log("transfer ownership of compoundAS to new rDai(proxy)", proxy.address);
        await web3tx(compoundAS.transferOwnership, "compoundAS.transferOwnership")(proxy.address);
        callback();
    } catch (err) {
        callback(err);
    }
};
