module.exports = async function (callback) {
    try {
        global.web3 = web3;

        let network = await web3.eth.net.getNetworkType();
        console.log("Current network:", network);

        const { web3tx } = require("@decentral.ee/web3-test-helpers");
        const CompoundAllocationStrategy = artifacts.require("CompoundAllocationStrategy");
        const RToken = artifacts.require("RToken");

        const cDAI = await require("./get-cdai")(artifacts, network);

        const compoundAS = await web3tx(CompoundAllocationStrategy.new, `CompoundAllocationStrategy.new cDAI ${cDAI.address}`)(
            cDAI.address, {
                gas: 1000000,
            }
        );
        //const compoundAS = { address: "0xF07d4967ae1F600144b25f40f655f61De2A9c0Ad" };
        const rToken = await web3tx(RToken.new, `RToken.new allocationStrategy ${compoundAS.address}`)(
            compoundAS.address,
            {
                gas: 5000000,
            }
        );
        console.log("rDai deployed at: ", rToken.address);
        console.log("transfer ownership of compoundAS to new rDai", rToken.address);
        await web3tx(compoundAS.transferOwnership, "compoundAS.transferOwnership")(rToken.address);
        callback();
    } catch (err) {
        callback(err);
    }
};
