// truffle --network NETWORK mint.js rToken(address) mintAmount(wad)
module.exports = async function (callback) {
    try {
        global.web3 = web3;

        const { web3tx, toWad, wad4human } = require("@decentral.ee/web3-test-helpers");

        const IERC20 = artifacts.require("IERC20");
        const RToken = artifacts.require("RToken");
        const IAllocationStrategy = artifacts.require("IAllocationStrategy");

        const rtokenAddress = process.argv[process.argv.length - 2];
        const mintAmount = process.argv[process.argv.length - 1];

        const rToken = await RToken.at(rtokenAddress);
        console.log("rToken address", rToken.address);
        const minter = (await web3.eth.getAccounts())[0];
        console.log("minter address", minter);
        console.log("mint amount", mintAmount);
        const underlying = await IERC20.at(
            await (await IAllocationStrategy.at(
                await rToken.getCurrentSavingStrategy.call()
            )).underlying.call());
        console.log("minter balanceOf underlying", wad4human(await underlying.balanceOf.call(minter)));
        await web3tx(underlying.approve, "underlying.approve")(rToken.address, toWad(mintAmount));
        await web3tx(rToken.mint, "rToken.mint")(toWad(mintAmount));

        callback();
    } catch (err) {
        callback(err);
    }
};
