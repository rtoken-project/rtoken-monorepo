const RTokenStorageLayoutTester = artifacts.require("RTokenStorageLayoutTester");
const { web3tx } = require("@decentral.ee/web3-test-helpers");

contract("RTokenStorage", accounts => {
    const admin = accounts[0];

    it("#0 validate immutable storage layout", async () => {
        const tester = await web3tx(RTokenStorageLayoutTester.new, "RTokenStorageLayoutTester.new")({ from: admin });
        await tester.validate.call();
    });
});
