const { promisify } = require("util");
const readline = require("readline");
const rl = require("./rl");

module.exports = async function (callback) {
    try {
        global.web3 = web3;


        let network = await web3.eth.net.getNetworkType();
        console.log("Current network:", network);

        const { web3tx } = require("@decentral.ee/web3-test-helpers");
        const CompoundAllocationStrategy = artifacts.require("CompoundAllocationStrategy");
        const RDAI = artifacts.require("rDAI");
        const Proxy = artifacts.require("Proxy");

        const addresses = require("./addresses")[network];

        let compoundASAddress = await promisify(rl.question)("Specify a deployed CompoundAllocationStrategy (deploy a new one if blank): ");
        let compoundAS;
        if (!compoundASAddress) {
            compoundAS = await web3tx(
                CompoundAllocationStrategy.new,
                `CompoundAllocationStrategy.new cDAI ${addresses.cDAI}`)(
                addresses.cDAI
            );
            console.log("compoundAllocationStrategy deployed at: ", compoundAS.address);
        } else {
            compoundAS = await CompoundAllocationStrategy.at(compoundASAddress);
        }

        let rDAIAddress = await promisify(rl.question)("Specify a deployed rDAI (deploy a new one if blank): ");
        let rDAI;
        if (!rDAIAddress) {
            rDAI = await web3tx(RDAI.new, "rDAI.new")();
            console.log("rDAI deployed at: ", rDAI.address);
        } else {
            rDAI = await RDAI.at(rDAIAddress);
        }

        const rDaiConstructCode = rDAI.contract.methods.initialize(compoundAS.address).encodeABI();
        console.log(`rDaiConstructCode rDAI.initialize(${rDaiConstructCode})`);
        const proxy = await web3tx(Proxy.new, "Proxy.new")(
            rDaiConstructCode, rDAI.address
        );
        console.log("proxy deployed at: ", proxy.address);

        console.log("transfer ownership of compoundAS to new rDai(proxy)", proxy.address);
        await web3tx(compoundAS.transferOwnership, "compoundAS.transferOwnership")(proxy.address);
        callback();
    } catch (err) {
        callback(err);
    }
};
