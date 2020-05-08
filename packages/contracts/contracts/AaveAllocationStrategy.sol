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

    using SafeMath for uint256;

    AToken private aToken;
    uint16 public aaveReferralCode;

    uint256 public totalInvestedUnderlying;
    uint256 public lastExchangeRate;
    uint256 public decimals;

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
    }

    /// @dev ISavingStrategy.underlying implementation
    function underlying() external view returns (address) {
        return aToken.underlyingAssetAddress();
    }

    /// @dev ISavingStrategy.exchangeRateStored implementation
    function exchangeRateStored() public view returns (uint256) {
        return aToken.balanceOf(address(this)).mul(decimals).div(totalInvestedUnderlying);
    }

    /// @dev ISavingStrategy.accrueInterest implementation
    function accrueInterest() external returns (bool) {
        return  true;
    }

    /// @dev ISavingStrategy.investUnderlying implementation
    function investUnderlying(uint256 investAmount) external onlyOwner returns (uint256) {

        totalInvestedUnderlying = totalInvestedUnderlying.add(investAmount);

        token.transferFrom(msg.sender, address(this), investAmount);

        address aaveLendingPool = aaveAddressesProvider.getLendingPool();

        token.approve(address(aaveLendingPool), investAmount);

        uint256 aTotalBefore = aToken.principalBalanceOf(address(this));

        // TODO should we handle mint failure?

        LendingPool(aaveLendingPool).deposit(address(token),investAmount,aaveReferralCode);

        uint256 aTotalAfter = aToken.principalBalanceOf(address(this));

        uint256 aCreatedAmount;

        aCreatedAmount = aTotalAfter.sub(aTotalBefore,"Aave minted negative amount!?");

        uint256 lastExchangeRate_ = exchangeRateStored();

        lastExchangeRate = lastExchangeRate_;

        return aCreatedAmount.mul(decimals).div(lastExchangeRate_);
    }

    /// @dev ISavingStrategy.redeemUnderlying implementation
    function redeemUnderlying(uint256 redeemAmount) external onlyOwner returns (uint256) {

        totalInvestedUnderlying = totalInvestedUnderlying.sub(redeemAmount);

        uint256 aTotalBefore = aToken.balanceOf(address(this));
        aToken.redeem(redeemAmount);
        uint256 aTotalAfter = aToken.balanceOf(address(this));
        uint256 aBurnedAmount;

        aBurnedAmount = aTotalBefore.sub(aTotalAfter,"Aave redeemed negative amount!?");
        token.transfer(msg.sender, redeemAmount);

        uint256 lastExchangeRate_ = exchangeRateStored();
        lastExchangeRate = lastExchangeRate_;

        return aBurnedAmount.mul(decimals).div(lastExchangeRate_);
    }

    /// @dev ISavingStrategy.redeemAll implementation
    function redeemAll() external onlyOwner
        returns (uint256 savingsAmount, uint256 underlyingAmount) {
        savingsAmount = aToken.balanceOf(address(this));

        aToken.redeem(savingsAmount);
        underlyingAmount = token.balanceOf(address(this));
        token.transfer(msg.sender, underlyingAmount);
    }


    // to check changeAllocationStrategy since it uses redeemAll wich I'm not sure if ti will work
}

    // function underlying2Aave(uint256 uAmount_) public view returns (uint256) {
    //      return uAmount_.mul(decimals).div(exchangeRateStored());
    // }
    
    // function aave2Underlying(uint256 aAmount_) public view returns (uint256) {
    //     return aAmount_.mul(exchangeRateStored()).div(decimals);
    // }