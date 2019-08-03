pragma solidity >=0.4.21 <0.6.0;

import {IERC20} from "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";

/**
 * @notice RToken interface a ERC20 interface and one can mint new tokens by
 *      trasfering underlying token into the contract, configure _hats_ for
 *      addresses and pay earned interest in new _rTokens_.
 */
contract IRToken is IERC20 {

    /**
     * @notice Sender supplies assets into the market and receives rTokens in exchange
     * @param mintAmount The amount of the underlying asset to supply
     * @return uint 0=success, otherwise a failure
     */
    function mint(uint256 mintAmount) external returns (bool);


    /**
     * @notice Sender supplies assets into the market and receives rTokens in exchange
     *         Also setting the a new hat for the fresh account.
     * @param mintAmount The amount of the underlying asset to supply
     * @param proportions Relative proportions of benefits received by the recipients
     * @return uint 0=success, otherwise a failure
     */
    function mintWithNewHat(uint256 mintAmount,
        address[] calldata recipients,
        uint32[] calldata proportions) external returns (bool);


    /**
     * @notice Sender redeems rTokens in exchange for the underlying asset
     * @param redeemTokens The number of rTokens to redeem into underlying
     * @return uint 0=success, otherwise a failure
     */
    function redeem(uint256 redeemTokens) external returns (bool);


    /**
     * @notice Create a new Hat
     * @param recipients List of beneficial recipients
     * @param proportions Relative proportions of benefits received by the recipients
     * @param doChangeHat Should the hat of the `msg.sender` be switched to the new one
     */
    function createHat(
        address[] calldata recipients,
        uint32[] calldata proportions,
        bool doChangeHat) external returns (uint256 hatID);

    /**
     * @notice Change the hat for `msg.sender`
     * @param hatID The id of the Hat
     */
    function changeHat(uint256 hatID) external;

    /**
     * @notice Get the hatID of the owner and the hat structure
     * @param owner Account owner address
     * @return hatID Hat ID
     * @return recipients Hat recipients
     * @return proportions Hat recipient's relative proportions
     */
    function getHatByAddress(address owner) external view
        returns (
            uint256 hatID,
            address[] memory recipients,
            uint32[] memory proportions);


    /**
     * @notice Get the hat structure
     * @param hatID Hat ID
     * @return recipients Hat recipients
     * @return proportions Hat recipient's relative proportions
     */
    function getHatByID(uint256 hatID) external view
        returns (
            address[] memory recipients,
            uint32[] memory proportions);

    /**
     * @notice Amount of free balance of the owner
     * @param owner Account owner address
     */
    function freeBalanceOf(address owner) external view returns (uint256 amount);

    /**
     * @notice Amount of saving assets given to the recipient along with the
     *         loans.
     * @param owner Account owner address
     */
    function receivedSavingsOf(address owner) external view returns (uint256 amount);

    /**
     * @notice Amount of token loaned to the recipient along with the savings
     *         assets.
     * @param owner Account owner address
     */
    function receivedLoanOf(address owner) external view returns (uint256 amount);

    /**
     * @notice Get the current interest balance of the owner.
               It is equivalent of: receivedSavings - receivedLoan - freeBalance
     * @param owner Account owner address
     */
    function interestPayableOf(address owner) external view returns (uint256 amount);


    /**
     * @notice pay interest to the owner
     * @param owner Account owner address
     *
     * Anyone can trigger the interest distribution on behalf of the recipient,
     * due to the fact that the recipient can be a contract code that has not
     * implemented the interaction with the rToken contract internally`.
     *
     * A interest lock-up period may apply, in order to mitigate the "hat
     * inheritance scam".
     */
    function payInterest(address owner) external returns (bool);

    /**
     * @notice Event emitted when tokens are minted
     */
    event Mint(address minter, uint256 mintAmount);

    /**
     * @notice Event emitted when tokens are redeemed
     */
    event Redeem(address redeemer, uint256 redeemAmount);

    /**
     * @notice Event emitted when interest paid
     */
    event InterestPaid(address recipient, uint256 interestAmount);

    /**
     * @notice A new hat is created
     */
    event HatCreated(uint256 indexed hatID);

    /**
     * @notice Hat is changed for the account
     */
    event HatChanged(address account, uint256 indexed hatID);
}
