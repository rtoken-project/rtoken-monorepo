module.exports = async function (artifacts, network) {
    const IERC20 = artifacts.require("IERC20");

    let cDAIAddress = "0x";

    // Contract addresses: https://compound.finance/developers#enter-markets
    if (network === "rinkeby") {
        cDAIAddress = "0x6d7f0754ffeb405d23c51ce938289d4835be3b14";
    } else if (network === "kovan") {
        cDAIAddress = "0x0a1e4d0b5c71b955c0a5993023fc48ba6e380496";
    } else if (network === "main") {
        cDAIAddress = "0xf5dce57282a584d2746faf1593d3121fcac444dc";
    }

    return IERC20.at(cDAIAddress);
};
