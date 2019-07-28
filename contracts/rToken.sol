pragma solidity >=0.4.21 <0.6.0;
import {IERC20} from "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import {CErc20Interface} from '../compound/contracts/CErc20Interface.sol';

contract rToken is IERC20 {

    //
    // ERC20 Interface
    //

    /**
     * @notice EIP-20 token name for this token
     */
    string public name = "Redeemable DAI (rDAI)";

    /**
     * @notice EIP-20 token symbol for this token
     */
    string public symbol = "rDAI";

    /**
     * @notice EIP-20 token decimals for this token
     */
    uint256 public decimals = 18;

    //
    // rToken interface
    //

    struct Hat {
        address[] recipients;
        uint256[] proportions;
    }

    /**
     * @notice Sender supplies assets into the market and receives cTokens in exchange
     * @dev Invest underlying assets immediately
     * @param mintAmount The amount of the underlying asset to supply
     * @return uint 0=success, otherwise a failure
     */
    function mint(uint256 mintAmount) external;

    /**
     * @notice Sender redeems rTokens in exchange for the underlying asset
     * @dev Withdraw equal amount of initially supplied underlying assets
     * @param redeemTokens The number of cTokens to redeem into underlying
     * @return uint 0=success, otherwise a failure
     */
    function redeem(uint256 redeemTokens) external;

    function createhat(
        address[] calldata recipients,
        uint256[] calldata proportions,
        bool doChangeHat) external returns (uint256 hatID);

    function changeHat(uint256 hatID) external;

    function getHat() external view returns (uint256 hatID);

    function describeHat(uint256 hatID) external view returns (
        address[] memory recipients,
        uint256[] memory proportions);

    function interestBalanceOf(address owner) external view;

    function withdrawInterest() external;

    event HatChanged(uint256 indexed hatID);
}
