const addresses = require("./addresses");

module.exports = function (network, tokenName) {
    const RTokenData = addresses[network][tokenName];
    if (RTokenData) {
        return RTokenData;
    } else {
        return {
            address: tokenName,
            creationBlockNumber: 0,
        };
    }
};
