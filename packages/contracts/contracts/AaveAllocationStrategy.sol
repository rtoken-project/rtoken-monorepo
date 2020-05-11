pragma solidity >=0.5.10 <0.6.0;

import {IAllocationStrategy} from "./IAllocationStrategy.sol";
import {Ownable} from "@openzeppelin/contracts/ownership/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {AToken} from "../aave/contracts/tokenization/AToken.sol";
import {LendingPool} from "../aave/contracts/lendingpool/LendingPool.sol";
import {LendingPoolCore} from "../aave/contracts/lendingpool/LendingPoolCore.sol";
import {LendingPoolAddressesProvider} from "../aave/contracts/configuration/LendingPoolAddressesProvider.sol";

contract AaveAllocationStrategy is IAllocationStrategy, Ownable {

    AToken private aToken;
    LendingPool private lendingPool;
    LendingPoolCore private lendingPoolCore;
    IERC20 private token;
    uint256 private totalInvested;

    event TotalInvested(uint indexed totalInvested);
    constructor(AToken aToken_, LendingPoolAddressesProvider lendingPoolAddressesProvider_) public {
        // Aave aToken
        aToken = aToken_;
        // Aave Lending Pool
        lendingPool = LendingPool(lendingPoolAddressesProvider_.getLendingPool());
        // Aave Lending Pool Core
        lendingPoolCore = LendingPoolCore(lendingPoolAddressesProvider_.getLendingPoolCore());
        // The aTokens underlying asset
        token = IERC20(aToken.underlyingAssetAddress());
    }

    /// @dev Returns the address of the underlying token
    function underlying() external view returns (address) {
        return address(token);
    }

    /// @dev Returnss the exchange rate from aToken to the underlying asset
    function exchangeRateStored() public view returns (uint256) {
        // Aave has a fixed exchange rate of 1:1 for aToken <-> underlying
        // Interest is modeled by increasing balance of aTokens
        // We calculate a virtual exchange rate based on the aToken balance and invested amount

        if(totalInvested == 0) {
            return 10**18;
        }

        // Safe Math not needed. aToken balance would need to be unfathomably high for the multiplication to overflow
        return (aToken.balanceOf(address(this)) * 10**18) / totalInvested;
    }

    /// @dev Accrues interest. Not required for Aave protocol. Always returns true
    function accrueInterest() external returns (bool) {
        // Aaves interest accrual does not need to be called explicitly
        // aToken.balanceOf() already contains the accrued interest
        return true;
    }

    /// @dev Invest investAmount of underlying asset into Aave
    function investUnderlying(uint256 investAmount) external onlyOwner returns (uint256) {
        // Transfer underlying from caller to this contract
        token.transferFrom(msg.sender, address(this), investAmount);
        // Approve the Aave Lending Pool to access the underlying tokens
        token.approve(address(lendingPoolCore), investAmount);
        // Store the aToken balance of aTokens before deposit
        uint256 aTotalBefore = aToken.balanceOf(address(this));
        // Deposit investAmount of underlying asset into Aave
        lendingPool.deposit(address(token), investAmount, 0);
        // Calculate the difference in aToken balance after deposit
        uint256 aTotalAfter = aToken.balanceOf(address(this));
        // Check the aToken balance has increased after deposit
        require (aTotalAfter >= aTotalBefore, "Aave minted negative amount!?");

        // Update totalInvested. We want to keep the exchange rate while updating the totalInvested.
        // We calculate the newTotalInvested value we need to have the same exchange rate as before
        // oldExchangeRate = newExchangeRate
        // oldATokenBalance / oldTotalInvested = newATokenBalance / newTotalInvested      // solve for newTotalInvested
        // newATokenBalance  / (oldATokenBalance / oldTotalInvested) = newTotalInvested
        // newTotalInvested = (newATokenBalance * oldTotalInvested) / oldATokenBalance
        if(aTotalBefore > 0) {
            totalInvested = (aTotalAfter * totalInvested) / aTotalBefore;
        } else {
            totalInvested = investAmount;
        }
        emit TotalInvested(totalInvested);

        // Return the difference in aToken balance
        return (investAmount * 10**18) / exchangeRateStored();
    }

    /// @dev Redeem redeemAmount from Aave
    function redeemUnderlying(uint256 redeemAmount) external onlyOwner returns (uint256) {
        // Store the aToken balance of aTokens before deposit
        uint256 aTotalBefore = aToken.balanceOf(address(this));
        // Redeem redeemAmount of underlying asset from Aave
        aToken.redeem(redeemAmount);
        // Calculate the difference in aToken balance after redeem
        uint256 aTotalAfter = aToken.balanceOf(address(this));
        // Check the aToken balance has decreased after redeem
        require(aTotalAfter <= aTotalBefore, "Aave redeemed negative amount!?");

        // Update totalInvested. We want to keep the exchange rate while updating the totalInvested.
        // We calculate the newTotalInvested value we need to have the same exchange rate as before
        // oldExchangeRate = newExchangeRate
        // oldATokenBalance / oldTotalInvested = newATokenBalance / newTotalInvested      // solve for newTotalInvested
        // newATokenBalance  / (oldATokenBalance / oldTotalInvested) = newTotalInvested
        // newTotalInvested = (newATokenBalance * oldTotalInvested) / oldATokenBalance
        totalInvested = (aTotalAfter * totalInvested) / aTotalBefore;
        emit TotalInvested(totalInvested);

        // Transfer redeemed underlying assets to caller
        token.transfer(msg.sender, redeemAmount);
        // Return the difference in aToken balance
        return (redeemAmount * 10**18) / exchangeRateStored();
    }

    /// @dev Redeem the entire balance of aToken from Aave
    function redeemAll() external onlyOwner
        returns (uint256 savingsAmount, uint256 underlyingAmount) {
        // Store the aToken balance of aTokens before deposit
        savingsAmount = aToken.balanceOf(address(this));
        // Redeem the entire aToken balance from Aave
        aToken.redeem(savingsAmount);
        underlyingAmount = token.balanceOf(address(this));
        // Update total invested amount
        totalInvested = 0;
        emit TotalInvested(totalInvested);
        // Transfer redeemed underlying assets to caller
        token.transfer(msg.sender, underlyingAmount);
    }

}