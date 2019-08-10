pragma solidity ^0.5.8;

import "../../compound/contracts/ComptrollerInterface.sol";

contract ComptrollerMock is ComptrollerInterface {
    /**
     * @notice Marker function used for light validation when updating the comptroller of a market
     * @dev Implementations should simply return true.
     * @return true
     */
    function isComptroller() external view returns (bool) { return true; }

    /*** Assets You Are In ***/

    function enterMarkets(address[] calldata cTokens) external returns (uint[] memory) {
        // TODO
    }

    function exitMarket(address cToken) external returns (uint) {
        // TODO
    }

    /*** Policy Hooks ***/

    function mintAllowed(address cToken, address minter, uint mintAmount) external returns (uint) {
        require(cToken != address(0));
        require(minter != address(0));
        require(mintAmount > 0);
        return 0;
    }
    function mintVerify(address cToken, address minter, uint mintAmount, uint mintTokens) external {
        require(cToken != address(0));
        require(minter != address(0));
        require(mintAmount > 0);
        require(mintTokens > 0);
    }

    function redeemAllowed(address cToken, address redeemer, uint redeemTokens) external returns (uint) {
        require(cToken != address(0));
        require(redeemer != address(0));
        require(redeemTokens > 0, "redeemTokens == 0");
        return 0;
    }
    function redeemVerify(address cToken, address redeemer, uint redeemAmount, uint redeemTokens) external {
        require(cToken != address(0));
        require(redeemer != address(0));
        require(redeemAmount > 0, "redeemAmount == 0");
        require(redeemTokens > 0, "redeemTokens == 0");

    }

    function borrowAllowed(address cToken, address borrower, uint borrowAmount) external returns (uint) {
        require(cToken != address(0));
        require(borrower != address(0));
        require(borrowAmount > 0, "borrowAmount == 0");
        return 0;
    }
    function borrowVerify(address cToken, address borrower, uint borrowAmount) external {
        require(cToken != address(0));
        require(borrower != address(0));
        require(borrowAmount > 0, "borrowAmount == 0");
    }

    function repayBorrowAllowed(
        address cToken,
        address payer,
        address borrower,
        uint repayAmount) external returns (uint) {
        require(cToken != address(0));
        require(payer != address(0));
        require(borrower != address(0));
        require(repayAmount > 0, "repayAmount == 0");
        return 0;
    }
    function repayBorrowVerify(
        address cToken,
        address payer,
        address borrower,
        uint repayAmount,
        uint /* borrowerIndex */) external {
        require(cToken != address(0));
        require(payer != address(0));
        require(borrower != address(0));
        require(repayAmount > 0, "repayAmount == 0");
    }

    function liquidateBorrowAllowed(
        address cTokenBorrowed,
        address cTokenCollateral,
        address liquidator,
        address borrower,
        uint repayAmount) external returns (uint) {
        require(cTokenBorrowed != address(0));
        require(cTokenCollateral != address(0));
        require(liquidator != address(0));
        require(borrower != address(0));
        require(repayAmount > 0, "repayAmount == 0");
        return 0;
    }
    function liquidateBorrowVerify(
        address cTokenBorrowed,
        address cTokenCollateral,
        address liquidator,
        address borrower,
        uint repayAmount,
        uint /* seizeTokens */) external {
        require(cTokenBorrowed != address(0));
        require(cTokenCollateral != address(0));
        require(liquidator != address(0));
        require(borrower != address(0));
        require(repayAmount > 0, "repayAmount == 0");
    }

    function seizeAllowed(
        address cTokenCollateral,
        address cTokenBorrowed,
        address liquidator,
        address borrower,
        uint /* seizeTokens */) external returns (uint){
        require(cTokenBorrowed != address(0));
        require(cTokenCollateral != address(0));
        require(liquidator != address(0));
        require(borrower != address(0));
        return 0;
    }
    function seizeVerify(
        address cTokenCollateral,
        address cTokenBorrowed,
        address liquidator,
        address borrower,
        uint /* seizeTokens */) external {
        require(cTokenBorrowed != address(0));
        require(cTokenCollateral != address(0));
        require(liquidator != address(0));
        require(borrower != address(0));
    }

    function transferAllowed(address cToken, address src, address dst, uint transferTokens) external returns (uint) {
        require(cToken != address(0));
        require(src != address(0));
        require(dst != address(0));
        require(transferTokens > 0);
        return 0;
    }
    function transferVerify(address cToken, address src, address dst, uint transferTokens) external {
        require(cToken != address(0));
        require(src != address(0));
        require(dst != address(0));
        require(transferTokens > 0);
    }

    /*** Liquidity/Liquidation Calculations ***/
    function liquidateCalculateSeizeTokens(
        address cTokenBorrowed,
        address cTokenCollateral,
        uint repayAmount) external view returns (uint amountSeizeError, uint seizeTokens) {
        require(cTokenBorrowed != address(0));
        require(cTokenCollateral != address(0));
        require(repayAmount > 0, "repayAmount == 0");
        amountSeizeError = 0;
        seizeTokens = 0;
    }
}
