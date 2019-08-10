const TruffleContract = require("truffle-contract");

module.exports = {
    load: (provider) => {
        let contracts = {
            IERC20 : TruffleContract(require("./build/contracts/IERC20.json")),
            IRToken : TruffleContract(require("./build/contracts/IRToken.json")),
            RinkebyTestDAI : TruffleContract(require("./build/contracts/RinkebyTestDAI.json")),
        };
        Object.values(contracts).forEach(i => i.setProvider(provider));
        return contracts;
    }
};
