const TruffleContract = require("truffle-contract");

module.exports = {
    load: (provider) => {
        let contracts = {
            RToken : TruffleContract(require("./build/contracts/RToken.json")),
        };
        Object.values(contracts).forEach(i => i.setProvider(provider));
        return contracts;
    }
};
