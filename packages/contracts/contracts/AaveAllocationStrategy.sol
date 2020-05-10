pragma solidity >=0.5.10 <0.6.0;

import {IAllocationStrategy} from "./IAllocationStrategy.sol";
import {Ownable} from "@openzeppelin/contracts/ownership/Ownable.sol";
import {ERC20Detailed} from "@openzeppelin/contracts/token/ERC20/ERC20Detailed.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {CErc20Interface} from "../compound/contracts/CErc20Interface.sol";

import "./aave/contracts/configuration/LendingPoolAddressesProvider.sol";
import "./aave/contracts/lendingpool/LendingPool.sol";
import "./aave/contracts/tokenization/AToken.sol";

contract AaveAllocationStrategy is IAllocationStrategy, Ownable {

    uint256 public totalStaked;

    using SafeMath for uint256;

    AToken private aToken;
    uint16 public aaveReferralCode;

    uint256 public totalInvestedUnderlying;
    uint256 public decimals;
    uint256 public lastTotalBalance;
    uint256 public lastExchangeRate;

    ERC20Detailed private token;
    LendingPoolAddressesProvider public aaveAddressesProvider;

    // initialize AAVE referral code, the code is provided by aave team.
    // the referral code will be linked with an address to collect aave referral rewards.
    function setReferralCode(uint16 _aaveReferralCode) public onlyOwner {
      aaveReferralCode = _aaveReferralCode;
    }


    // aaveAddressesProvider_ is the contract address where aave register all their contract 
    // to query them later on
    constructor(AToken aToken_, address aaveAddressesProvider_) public {
        require(address(aToken_) != address(0x0));
        require(aaveAddressesProvider_ != address(0x0));
        aToken = aToken_;
        token = ERC20Detailed(aToken.underlyingAssetAddress());
        decimals = 10 ** uint256(token.decimals());
        lastExchangeRate = decimals;
        aaveAddressesProvider = LendingPoolAddressesProvider(aaveAddressesProvider_);
    }

    /// @dev ISavingStrategy.underlying implementation
    function underlying() external view returns (address) {
        return aToken.underlyingAssetAddress();
    }

    /// @dev ISavingStrategy.exchangeRateStored implementation
    function exchangeRateStored() public view returns (uint256) {
        uint256 newtotalBalance = aToken.balanceOf(address(this));

        // to compute the share that is equivalent to the cTokens we have first to find the 
        // exchange rate that guarentee that all the previously made deposit earnings will
        // will not change when a new deposit happens. the exchange rate is defined as the 
        // previous exchange rate added to the interest that occured since the last transaction
        // devided by the total staked amount.
        uint256 interest = newtotalBalance.sub(lastTotalBalance);
        if (totalStaked == 0) {
            return lastExchangeRate;
        }
        return lastExchangeRate.add(interest.mul(decimals).div(totalStaked));
    }

    /// @dev ISavingStrategy.accrueInterest implementation
    // the same description apply to accrueInterest as exchangeRateStored except that this function
    // saves the variable into the storage.
    function accrueInterest() public returns (bool) {
        uint256 newtotalBalance = aToken.balanceOf(address(this));
        uint256 interest = newtotalBalance.sub(lastTotalBalance);
        if (totalStaked > 0) {
            lastExchangeRate = lastExchangeRate.add(interest.mul(decimals).div(totalStaked));
        }
        lastTotalBalance = newtotalBalance;
        return  true;
    }

    /// @dev ISavingStrategy.investUnderlying implementation
    function investUnderlying(uint256 investAmount) external onlyOwner returns (uint256) {
        // update the exchange rate
        accrueInterest();
        // add investAmount to lastTotalBalance to avoid that it will be counted as interest.
        lastTotalBalance = lastTotalBalance.add(investAmount);
        
        token.transferFrom(msg.sender, address(this), investAmount);
        token.approve(aaveAddressesProvider.getLendingPoolCore(), investAmount);
        
        uint256 aTotalBefore = aToken.balanceOf(address(this));
        LendingPool(aaveAddressesProvider.getLendingPool()).deposit(address(token), investAmount, aaveReferralCode);
        uint256 aTotalAfter = aToken.balanceOf(address(this));
        
        uint256 aCreatedAmount;
        // computing the minted amount just as a precaution.
        aCreatedAmount = aTotalAfter.sub(aTotalBefore, "Aave minted negative amount!?");

        // computing the shares that are equivalents to cTokens for compound.
        uint256 mintedShares = aCreatedAmount.mul(decimals).div(lastExchangeRate); 
        // keep track of the total staked share at any moment.
        totalStaked = totalStaked.add(mintedShares);
        return  mintedShares;
    }

    /// @dev ISavingStrategy.redeemUnderlying implementation
    function redeemUnderlying(uint256 redeemAmount) external onlyOwner returns (uint256) {
        // update the exchange rate
        accrueInterest();
        // substract redeemAmount from lastTotalBalance to avoid that it reduce the value interest.
        lastTotalBalance = lastTotalBalance.sub(redeemAmount);
        uint256 aTotalBefore = aToken.balanceOf(address(this));
        aToken.redeem(redeemAmount);
        uint256 aTotalAfter = aToken.balanceOf(address(this));
        uint256 aBurnedAmount = aTotalBefore.sub(aTotalAfter, "Aave redeemed negative amount!?");
        // computing the shares that are equivalents to cTokens for compound.
        uint256 burnedShares = aBurnedAmount.mul(decimals).div(lastExchangeRate);
        // keep track of the total staked share at any moment.
        totalStaked = totalStaked.sub(burnedShares);
        token.transfer(msg.sender, redeemAmount);
        return burnedShares;
    }

    // @dev ISavingStrategy.redeemAll implementation
    // redeemAll description is similar to redeemUnderlying
    function redeemAll() external onlyOwner returns (uint256 savingsAmount, uint256 underlyingAmount) {
        accrueInterest();
        uint256 redeemAllAmount = aToken.balanceOf(address(this));

        aToken.redeem(redeemAllAmount);
        savingsAmount = redeemAllAmount.mul(decimals).div(lastExchangeRate);
        underlyingAmount = token.balanceOf(address(this));
        totalStaked = totalStaked.sub(savingsAmount);
        token.transfer(msg.sender, underlyingAmount);
    }
}