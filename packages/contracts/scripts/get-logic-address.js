const PROXIABLE_UUID = "0xc5f16f0fcc639fa48a6947836d9850f504798523bf8c9a3a87d5876cf622bcf7";

module.exports = async function (callback) {
    try {
        global.web3 = web3;
        const proxyAddress = process.argv[process.argv.length - 1];
        const logicAddress = (await web3.eth.getStorageAt(proxyAddress, PROXIABLE_UUID)).substr(-40, 40);
        console.log(`PROXIABLE contract ${proxyAddress} has its logic address at 0x${logicAddress}`);
        callback();
    } catch (err) {
        callback(err);
    }
};
