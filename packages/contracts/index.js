const TruffleContract = require("@truffle/contract");

module.exports = {
    load: (provider) => {
        let contracts = {
            IRToken : TruffleContract(require("./build/contracts/IRToken.json")),
            IERC20 : TruffleContract(require("@openzeppelin/contracts/build/contracts/IERC20.json")),
            TestDaiFaucet : TruffleContract(require("./build/contracts/TestDaiFaucet.json")),
        };
        Object.values(contracts).forEach(i => i.setProvider(provider));
        return contracts;
    }
};
