const TruffleContract = require("truffle-contract");

module.exports = {
    load: (provider) => {
        let contracts = {
            IRToken : TruffleContract(require("./build/contracts/IRToken.json")),
        };
        Object.values(contracts).forEach(i => i.setProvider(provider));
        return contracts;
    }
};
