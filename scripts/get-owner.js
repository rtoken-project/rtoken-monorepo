module.exports = async function (callback) {
    try {
        global.web3 = web3;

        const Ownable = artifacts.require("Ownable");

        const address = process.argv[process.argv.length - 1];

        const ownable = await Ownable.at(address);
        console.log("owner address", await ownable.owner.call());

        callback();
    } catch (err) {
        callback(err);
    }
};
