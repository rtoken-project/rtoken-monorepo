const ERC20Mintable = artifacts.require("ERC20Mintable");
const AaveAllocationStrategy = artifacts.require("AaveAllocationStrategy");
const DaiMock = artifacts.require("DaiMock");
const ATokenMock = artifacts.require("ATokenMock");
const LendingPoolMock = artifacts.require("LendingPoolMock");
const LendingPoolAddressesProviderMock = artifacts.require("LendingPoolAddressesProviderMock");
const RToken = artifacts.require("RToken");

const { web3tx, wad4human, toWad } = require("@decentral.ee/web3-test-helpers");

const {
  BN, 
  time,
  constants,
  expectEvent,
  expectRevert,
} = require('@openzeppelin/test-helpers');

contract("RToken with Aave Strategy", accounts => {
    before(async () => {    
        dai = await DaiMock.new("dai token","dai",18)
        adai = await ATokenMock.new("adai token", "adai",18,dai.address)
        lendingPool = await LendingPoolMock.new()
        lendingPoolAddressesProvider = await LendingPoolAddressesProviderMock.new()

        await lendingPoolAddressesProvider.setLendingPool(lendingPool.address)
        await lendingPool.setAToken(dai.address,adai.address)
        await adai.addMinter(lendingPool.address)
        await dai.addMinter(adai.address)

        aaveAS = await AaveAllocationStrategy.new(adai.address,lendingPoolAddressesProvider.address)

        rdai = await RToken.new()
        await rdai.initialize(aaveAS.address,"rDAI test","rDAI",18)
        await aaveAS.transferOwnership(rdai.address)
    })

    it("#0 initial test condition", async () => {
        await dai.mint(accounts[0],web3.utils.toWei("100"))
        await dai.mint(accounts[1],web3.utils.toWei("100"))
        assert.equal(wad4human(await rdai.totalSupply()), "0.00000")
        assert.equal(wad4human(await adai.balanceOf(accounts[0])), "0.00000")
        assert.equal(wad4human(await dai.balanceOf(accounts[0])), "100.00000")
        assert.equal(wad4human(await dai.totalSupply()), "200.00000")
    });

    it("#1 mint test", async () => {
        await expectRevert.unspecified(rdai.mint(web3.utils.toWei("1"),{from: accounts[0]}))
        await dai.approve(rdai.address,web3.utils.toWei("1"),{from: accounts[0]})
        await rdai.mint(web3.utils.toWei("1"),{from: accounts[0]})
        console.log("")
        console.log(await aaveAS.exchangeRateStored()/1)
        console.log(await adai.balanceOf(aaveAS.address) /1)
        console.log(await rdai.getAccountStats(accounts[0]))
        await time.advanceBlock();
        console.log("")
        console.log(await aaveAS.exchangeRateStored()/1)
        console.log(await adai.balanceOf(aaveAS.address) /1)
        console.log(await rdai.getAccountStats(accounts[0]))

        await time.advanceBlock();
        console.log("")
        console.log(await aaveAS.exchangeRateStored()/1)
        console.log(await adai.balanceOf(aaveAS.address) /1)
        console.log(await rdai.getAccountStats(accounts[0]))

        await dai.approve(rdai.address,web3.utils.toWei("1"),{from: accounts[0]})
        await rdai.mint(web3.utils.toWei("1"),{from: accounts[0]})
        
        console.log("")
        console.log(await aaveAS.exchangeRateStored()/1)
        console.log(await adai.balanceOf(aaveAS.address) /1)
        console.log(await rdai.getAccountStats(accounts[0]))
        
        await time.advanceBlock();

        console.log("")
        console.log(await aaveAS.exchangeRateStored()/1)
        console.log(await adai.balanceOf(aaveAS.address) /1)
        console.log(await rdai.getAccountStats(accounts[0]))

        await rdai.mint(web3.utils.toWei("0"),{from: accounts[0]})

        console.log("")
        console.log(await aaveAS.exchangeRateStored()/1)
        console.log(await adai.balanceOf(aaveAS.address) /1)
        console.log(await rdai.getAccountStats(accounts[0]))
        console.log(await rdai.balanceOf(accounts[0])/1)

        await dai.approve(rdai.address,web3.utils.toWei("3"),{from: accounts[1]})
        await rdai.mint(web3.utils.toWei("3"),{from: accounts[1]})

        console.log("")
        
        console.log(await aaveAS.exchangeRateStored()/1)
        console.log(await adai.balanceOf(aaveAS.address) /1)
        
        console.log(await rdai.getAccountStats(accounts[0]))
        console.log(await rdai.getAccountStats(accounts[1]))

        console.log(await rdai.balanceOf(accounts[0])/1)
        console.log(await rdai.balanceOf(accounts[1])/1)

        await rdai.mint(web3.utils.toWei("0"),{from: accounts[0]})      
        await rdai.mint(web3.utils.toWei("0"),{from: accounts[1]})
        console.log(await adai.balanceOf(aaveAS.address)/1)  

        await rdai.redeemAll({from: accounts[1]})
        await rdai.mint(web3.utils.toWei("0"),{from: accounts[0]})
        console.log("")
        console.log(await rdai.balanceOf(accounts[0])/1)
        console.log(await rdai.balanceOf(accounts[1])/1)
        console.log(await adai.balanceOf(aaveAS.address)/1)  
        
    });

})
