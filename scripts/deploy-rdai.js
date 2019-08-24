module.exports = async (callback) => {
    try {
        global.web3 = web3;

        const { web3tx } = require("@decentral.ee/web3-test-helpers");
        const CompoundAllocationStrategy = artifacts.require("CompoundAllocationStrategy");
        const RToken = artifacts.require("RToken");

        let network = await web3.eth.net.getNetworkType();

        console.log("Current network:", network);

        let cDAIAddress;
        // Contract addresses: https://compound.finance/developers#enter-markets
        if (network === "rinkeby") {
            cDAIAddress = "0x6d7f0754ffeb405d23c51ce938289d4835be3b14";
        } else if (network === "kovan") {
            cDAIAddress = "0x0a1e4d0b5c71b955c0a5993023fc48ba6e380496";
        } else if (network === "main") {
            cDAIAddress = "0xf5dce57282a584d2746faf1593d3121fcac444dc";
        }

        if (cDAIAddress) {
            const compoundAS = await web3tx(CompoundAllocationStrategy.new, `CompoundAllocationStrategy.new cDAI ${cDAIAddress}`)(
                cDAIAddress, {
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
        }
        callback();
    } catch (err) {
        callback(err);
    }
};
