// truffle --network NETWORK mint.js rToken(address) mintAmount(wad)
module.exports = async function (callback) {
    try {
        global.web3 = web3;

        const { web3tx, toWad } = require("@decentral.ee/web3-test-helpers");

        let network = await web3.eth.net.getNetworkType();
        console.log("Current network:", network);

        const IERC20 = artifacts.require("IERC20");
        const RToken = artifacts.require("RToken");
        const IAllocationStrategy = artifacts.require("IAllocationStrategy");

        const rToken = await RToken.at(process.argv[6]);
        const mintAmount = process.argv[7] || 10;
        console.log("rToken address", rToken.address);
        const minter = (await web3.eth.getAccounts())[0];
        console.log("minter address", minter);
        console.log("mint amount", mintAmount);
        const underlying = await IERC20.at(
            await (await IAllocationStrategy.at(
                await rToken.getCurrentSavingStrategy.call()
            )).underlying.call());
        await web3tx(underlying.approve, "underlying.approve")(rToken.address, toWad(mintAmount));
        await web3tx(rToken.mint, "rToken.mint")(toWad(mintAmount));

        callback();
    } catch (err) {
        callback(err);
    }
};
