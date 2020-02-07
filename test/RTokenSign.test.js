const CErc20 = artifacts.require("CErc20");
const ComptrollerMock = artifacts.require("ComptrollerMock");
const InterestRateModelMock = artifacts.require("InterestRateModelMock");
const CompoundAllocationStrategy = artifacts.require("CompoundAllocationStrategy");
const RToken = artifacts.require("RToken");
const Proxy = artifacts.require("Proxy");
const { web3tx, wad4human, toWad } = require("@decentral.ee/web3-test-helpers");


const Dai = artifacts.require("Dai");

const ethUtil = require("ethereumjs-util");
const abi = require("ethereumjs-abi");

contract("RToken With DAI Permit Functions", accounts => {

    const admin = accounts[0];
    const bingeBorrower = accounts[1];
    const business = accounts[2];
    let dai_token;
    let compoundAS;

    let rToken;
    let rTokenLogic;

    const privateKey = ethUtil.keccak256("cow");
    // '0xc85ef7d79691fe79573b1a7064c19c1a9819ebdbd1faaab1a8ec92344438aaf4'
    const address = ethUtil.privateToAddress(privateKey);
    const holder = ethUtil.bufferToHex(address);

    async function createCompoundAllocationStrategy(cTokenExchangeRate) {
        const comptroller = await web3tx(ComptrollerMock.new, "ComptrollerMock.new")({ from: admin });
        const interestRateModel = await web3tx(InterestRateModelMock.new, "InterestRateModelMock.new")({ from: admin });
        const cToken = await web3tx(CErc20.new, "CErc20.new")(
            dai_token.address,
            comptroller.address,
            interestRateModel.address,
            cTokenExchangeRate, // 1 cToken == cTokenExchangeRate * dai_token
            "Compound token",
            "cToken",
            18, {
                from: admin
            });
        const compoundAS = await web3tx(CompoundAllocationStrategy.new, "CompoundAllocationStrategy.new")(
            cToken.address, {
                from: admin
            }
        );
        return { cToken, compoundAS };
    }

    function parseHat({hatID, recipients, proportions}) {
        const hatObj = {
            recipients: recipients,
            proportions: proportions.map(i=>i.toNumber())
        };
        if (typeof(hatID) !== "undefined") {
            hatObj.hatID = hatID.toNumber();
        }
        return hatObj;
    }

    // Helper for EIP712 signature.
    // Recursively finds all the dependencies of a type
    function dependencies(types, primaryType, found = []) {
        if (found.includes(primaryType)) {
            return found;
        }
        if (types[primaryType] === undefined) {
            return found;
        }
        found.push(primaryType);
        for (let field of types[primaryType]) {
            for (let dep of dependencies(field.type, found)) {
                if (!found.includes(dep)) {
                    found.push(dep);
                }
            }
        }
        return found;
    }

    // Helper for EIP712 signature.
    function encodeType(types, primaryType) {
        // Get dependencies primary first, then alphabetical
        let deps = dependencies(types, primaryType);
        deps = deps.filter(t => t != primaryType);
        deps = [primaryType].concat(deps.sort());

        // Format as a string with fields
        let result = "";
        for (let type of deps) {
           result += `${type}(${types[type].map(({ name, type }) => `${type} ${name}`).join(",")})`;
        }
        return result;
    }

    // Helper for EIP712 signature.
    function encodeData(types, primaryType, data) {
        let encTypes = [];
        let encValues = [];

        // Add typehash
        encTypes.push("bytes32");
        encValues.push(ethUtil.keccak256(encodeType(types, primaryType)));

        // Add field contents
        for (let field of types[primaryType]) {
            let value = data[field.name];
            if (field.type == "string" || field.type == "bytes") {
                encTypes.push("bytes32");
                value = ethUtil.keccak256(value);
                encValues.push(value);
            } else if (types[field.type] !== undefined) {
                encTypes.push("bytes32");
                value = ethUtil.keccak256(encodeData(field.type, value));
                encValues.push(value);
            } else if (field.type.lastIndexOf("]") === field.type.length - 1) {
                throw "TODO: Arrays currently unimplemented in encodeData";
            } else {
                encTypes.push(field.type);
                encValues.push(value);
            }
        }

        return abi.rawEncode(encTypes, encValues);
    }

    // Helper for EIP712 signature.
    function structHash(types, primaryType, data) {
        return ethUtil.keccak256(encodeData(types, primaryType, data));
    }

    before(async () => {
        console.log("admin is", admin);
        console.log("bingeBorrower is", bingeBorrower);
        console.log("business is", business);
        console.log("holder is", holder);
    });

    beforeEach(async () => {
        // Deploys rToken logice.
        // Mints DAI & rDAI for holder account.

        const chainId = await web3.eth.net.getId();
        dai_token = await Dai.new(chainId, { from: admin });

        await web3tx(dai_token.mint, "dai_token.mint 1000 -> holder")(holder, toWad(1000), { from: admin });

        {
            const result = await createCompoundAllocationStrategy(toWad(.1));
            var cToken = result.cToken;
            compoundAS = result.compoundAS;
        }

        // Deploy the rToken logic/library contract
        rTokenLogic = await web3tx(RToken.new, "RToken.new")(
            {
                from: admin
            });
        // Get the init code for rToken
        const rTokenConstructCode = rTokenLogic.contract.methods.initialize(
            compoundAS.address,
            "RToken Test",
            "RTOKEN",
            18).encodeABI();

        // Deploy the Proxy, using the init code for rToken
        const proxy = await web3tx(Proxy.new, "Proxy.new")(
            rTokenConstructCode, rTokenLogic.address, {
                from: admin
            });
        // Create the rToken object using the proxy address
        rToken = await RToken.at(proxy.address);

        await web3tx(compoundAS.transferOwnership, "compoundAS.transferOwnership")(rToken.address);
        var SELF_HAT_ID = await rToken.SELF_HAT_ID.call();
    });

    it("MintFor Test", async () => {
        // The 'spender' here is the rDAI contract.
        // Holder has DAI.
        // Holder signs EIP712 DAI permit message.
        // Business calls MintFor with signed message from Holder.

        // Initially the holder should have no rDAI, only has DAI (but no ETH).
        var rDAI_Balance = await rToken.balanceOf(holder);
        assert.equal(wad4human(rDAI_Balance), "0.00000", "Initial holder rDAI balance should be 0");
        rDAI_Balance = await rToken.balanceOf(rToken.address);
        assert.equal(wad4human(rDAI_Balance), "0.00000", "Initial spender rDAI balance should be 0");

        // Intiially the rDAI contract has no allowance of DAI token for spender.
        var allowance = await dai_token.allowance.call(holder, rToken.address)
        assert.equal(wad4human(allowance), "0.00000", "Initial DAI allowance should be 0");

        // First call of DAI permit so nonce is 0.
        var nonce = await dai_token.nonces.call(holder);
        assert.equal(0, nonce, "Initial DAI nonce should be 0");

        // EIP712 signing set-up.
        const types = {
            EIP712Domain: [
                { name: "name", type: "string" },
                { name: "version", type: "string" },
                { name: "chainId", type: "uint256" },
                { name: "verifyingContract", type: "address" },
            ],
            Permit: [
                { name: "holder", type: "address"},
                { name: "spender", type: "address"},
                { name: "nonce", type: "uint256"},
                { name: "expiry", type: "uint256"},
                { name: "allowed", type: "bool"}
            ],
        }

        const chainId = await web3.eth.net.getId();

        const domain = {
            name: "Dai Stablecoin",
            version: "1",
            chainId: chainId,
            verifyingContract: dai_token.address
        }

        const message = {
            holder: holder,
            spender: rToken.address,
            nonce: nonce,
            expiry: 0,
            allowed: true
        }

        const hash = ethUtil.keccak256(
                        Buffer.concat([
                            Buffer.from("1901", "hex"),
                            structHash(types, "EIP712Domain", domain),
                            structHash(types, "Permit", message),
                        ]),
                    );

        // The holder signs the permit message (This would normally be done via MetaMask or similar)
        const sig = ethUtil.ecsign(hash, privateKey);

        // Business calls for holder.
        await rToken.mintFor(toWad(100),
                              holder,
                              rToken.address,
                              nonce,
                              0,
                              true,
                              sig.v,
                              ethUtil.bufferToHex(sig.r),
                              ethUtil.bufferToHex(sig.s),
                              { from: business });

        // Holder should now have rDAI.
        rDAI_Balance = await rToken.balanceOf(holder);
        assert.equal(wad4human(rDAI_Balance), "100.00000", "Holder rDAI balance should be 100");
        rDAI_Balance = await rToken.balanceOf(rToken.address);
        assert.equal(wad4human(rDAI_Balance), "0.00000", "Initial spender rDAI balance should be 0");

        // DAI permit has been called so nonce is incremented.
        nonce = await dai_token.nonces.call(holder);
        assert.equal(1, nonce, "Nonce should be 1");

        allowance = await dai_token.allowance.call(holder, rToken.address)
        const max = web3.utils.toTwosComplement(-1);
        var t = web3.utils.toBN(max);
        assert.equal(wad4human(allowance), wad4human(t.toString()), "Allowance should be max.");

        // Check hat
        assert.deepEqual(parseHat(await rToken.getHatByAddress.call(holder)), {
            hatID: 0,
            recipients: [],
            proportions: []
        });
    });

    it("mintForWithSelectedHat Test", async () => {
        // The 'spender' here is the rDAI contract.
        // Admin creates a new hat separately - Hat ID = 1
        // Holder has DAI.
        // Holder signs EIP712 DAI permit message.
        // Business calls mintForWithSelectedHat with signed message & Hat ID = 1 for holder

        // Initially the holder should have no rDAI, only has DAI.
        var rDAI_Balance = await rToken.balanceOf(holder);
        assert.equal(wad4human(rDAI_Balance), "0.00000", "Initial holder rDAI balance should be 0");
        rDAI_Balance = await rToken.balanceOf(rToken.address);
        assert.equal(wad4human(rDAI_Balance), "0.00000", "Initial spender rDAI balance should be 0");

        // Check hat
        var hat = await rToken.getHatByAddress.call(holder);
        assert.equal(hat[0], 0, "Initial hat ID should be 0.")

        // Intiially the rDAI contract has no allowance of DAI token for spender.
        var allowance = await dai_token.allowance.call(holder, rToken.address)
        assert.equal(wad4human(allowance), "0.00000", "Initial DAI allowance should be 0");

        // First call of DAI permit so nonce is 0.
        var nonce = await dai_token.nonces.call(holder);
        assert.equal(0, nonce, "Initial DAI nonce should be 0");

        // EIP712 signing set-up.
        const types = {
            EIP712Domain: [
                { name: "name", type: "string" },
                { name: "version", type: "string" },
                { name: "chainId", type: "uint256" },
                { name: "verifyingContract", type: "address" },
            ],
            Permit: [
                { name: "holder", type: "address"},
                { name: "spender", type: "address"},
                { name: "nonce", type: "uint256"},
                { name: "expiry", type: "uint256"},
                { name: "allowed", type: "bool"}
            ],
        }

        const chainId = await web3.eth.net.getId();

        const domain = {
            name: "Dai Stablecoin",
            version: "1",
            chainId: chainId,
            verifyingContract: dai_token.address
        }

        const message = {
            holder: holder,
            spender: rToken.address,
            nonce: nonce,
            expiry: 0,
            allowed: true
        }

        const hash = ethUtil.keccak256(
                        Buffer.concat([
                            Buffer.from("1901", "hex"),
                            structHash(types, "EIP712Domain", domain),
                            structHash(types, "Permit", message),
                        ]),
                    );

        // The holder signs the permit message (This would normally be done via MetaMask or similar)
        const sig = ethUtil.ecsign(hash, privateKey);

        // Create new hat then mint for that hat
        await rToken.createHat([holder], [100], false);

        // Business calls mintForWithSelectedHat using signed message
        await rToken.mintForWithSelectedHat(toWad(100),
                                            1,
                                            holder,
                                            rToken.address,
                                            nonce,
                                            0,
                                            true,
                                            sig.v,
                                            ethUtil.bufferToHex(sig.r),
                                            ethUtil.bufferToHex(sig.s),
                                            { from: business });

        // Holder should now have rDAI.
        rDAI_Balance = await rToken.balanceOf(holder);
        assert.equal(wad4human(rDAI_Balance), "100.00000", "Holder rDAI balance should be 100");
        rDAI_Balance = await rToken.balanceOf(rToken.address);
        assert.equal(wad4human(rDAI_Balance), "0.00000", "Initial spender rDAI balance should be 0");

        // DAI permit has been called so nonce is incremented.
        nonce = await dai_token.nonces.call(holder);
        assert.equal(1, nonce, "Nonce should be 1");

        allowance = await dai_token.allowance.call(holder, rToken.address)
        const max = web3.utils.toTwosComplement(-1);
        var t = web3.utils.toBN(max);
        assert.equal(wad4human(allowance), wad4human(t.toString()), "Allowance should be max.");

        // Check hat
        hat = await rToken.getHatByAddress.call(holder);
        assert.equal(hat[0], 1, "New hat ID should be 1.")
    });
});
