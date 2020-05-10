pragma solidity >=0.5.10 <0.6.0;

import {IAllocationStrategy} from "./IAllocationStrategy.sol";
import {Ownable} from "@openzeppelin/contracts/ownership/Ownable.sol";
import {ERC20Detailed} from "@openzeppelin/contracts/token/ERC20/ERC20Detailed.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {CErc20Interface} from "../compound/contracts/CErc20Interface.sol";

import "../aave/contracts/configuration/LendingPoolAddressesProvider.sol";
import "../aave/contracts/lendingpool/LendingPool.sol";
import "../aave/contracts/tokenization/AToken.sol";

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
    function setReferralCode(uint16 _aaveReferralCode) public onlyOwner {
      require(_aaveReferralCode>0);
      aaveReferralCode = _aaveReferralCode;
    }

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
        uint256 interest = newtotalBalance.sub(lastTotalBalance);
        if(totalStaked==0) return lastExchangeRate;
        return lastExchangeRate.add(interest.mul(decimals).div(totalStaked));
    }

    /// @dev ISavingStrategy.accrueInterest implementation
    function accrueInterest() public returns (bool) {
        uint256 newtotalBalance = aToken.balanceOf(address(this));
        uint256 interest = newtotalBalance.sub(lastTotalBalance);
        if(totalStaked > 0) lastExchangeRate = lastExchangeRate.add(interest.mul(decimals).div(totalStaked));
        lastTotalBalance = newtotalBalance;
        return  true;
    }

    /// @dev ISavingStrategy.investUnderlying implementation
    function investUnderlying(uint256 investAmount) external onlyOwner returns (uint256) {

        accrueInterest();
        lastTotalBalance = lastTotalBalance.add(investAmount);
        token.transferFrom(msg.sender, address(this), investAmount);
        token.approve(aaveAddressesProvider.getLendingPoolCore(), investAmount);
        uint256 aTotalBefore = aToken.balanceOf(address(this));
        LendingPool(aaveAddressesProvider.getLendingPool()).deposit(address(token),investAmount,aaveReferralCode);
        uint256 aTotalAfter = aToken.balanceOf(address(this));
        uint256 aCreatedAmount;
        aCreatedAmount = aTotalAfter.sub(aTotalBefore,"Aave minted negative amount!?");
        aCreatedAmount = aCreatedAmount.mul(decimals).div(lastExchangeRate); 
        totalStaked = totalStaked.add(aCreatedAmount);
        return  aCreatedAmount;
    }

    /// @dev ISavingStrategy.redeemUnderlying implementation
    function redeemUnderlying(uint256 redeemAmount) external onlyOwner returns (uint256) {

        accrueInterest();
        lastTotalBalance = lastTotalBalance.sub(redeemAmount);

        uint256 aTotalBefore = aToken.balanceOf(address(this));
        aToken.redeem(redeemAmount);
        uint256 aTotalAfter = aToken.balanceOf(address(this));
        uint256 aBurnedAmount = aTotalBefore.sub(aTotalAfter,"Aave redeemed negative amount!?");
        token.transfer(msg.sender, redeemAmount);
        aBurnedAmount = aBurnedAmount.mul(decimals).div(lastExchangeRate);
        totalStaked = totalStaked.sub(aBurnedAmount);
        return aBurnedAmount;
    }

    // @dev ISavingStrategy.redeemAll implementation
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