const TruffleContract = require("truffle-contract");

module.exports = {
    load: (provider) => {
        let contracts = {
            IRToken : TruffleContract(require("./build/contracts/IRToken.json")),
            IERC20 : TruffleContract(require("openzeppelin-solidity/build/contracts/IERC20.json")),
            RinkebyTestDAI : TruffleContract(require("./build/contracts/RinkebyTestDAI.json")),
        };
        Object.values(contracts).forEach(i => i.setProvider(provider));
        return contracts;
    }
};
