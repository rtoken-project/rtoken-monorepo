/**
 * Because the use of ABIEncoderV2 , the pragma should be locked above 0.5.10 ,
 * as there is a known bug in array storage:
 * https://blog.ethereum.org/2019/06/25/solidity-storage-array-bugs/
 */
pragma solidity >=0.5.10 <0.6.0;
pragma experimental ABIEncoderV2;

import {RTokenStructs} from "./RTokenStructs.sol";
import {IERC20} from "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";

/**
 * @notice RToken interface a ERC20 interface and one can mint new tokens by
 *      trasfering underlying token into the contract, configure _hats_ for
 *      addresses and pay earned interest in new _rTokens_.
 */
contract IRToken is RTokenStructs, IERC20 {
    ////////////////////////////////////////////////////////////////////////////
    // For external transactions
    ////////////////////////////////////////////////////////////////////////////
    /**
     * @notice Sender supplies assets into the market and receives rTokens in exchange
     * @param mintAmount The amount of the underlying asset to supply
     * @return bool true=success, otherwise a failure
     */
    function mint(uint256 mintAmount) external returns (bool);

    /**
     * @notice Sender supplies assets into the market and receives rTokens in exchange
     *         Also setting the a selected hat for the account.
     * @param hatID The id of the selected Hat
     * @return bool true=success, otherwise a failure
     */
    function mintWithSelectedHat(uint256 mintAmount, uint256 hatID)
        external
        returns (bool);

    /**
     * @notice Sender supplies assets into the market and receives rTokens in exchange
     *         Also setting the a new hat for the account.
     * @param mintAmount The amount of the underlying asset to supply
     * @param proportions Relative proportions of benefits received by the recipients
     * @return bool true=success, otherwise a failure
     */
    function mintWithNewHat(
        uint256 mintAmount,
        address[] calldata recipients,
        uint32[] calldata proportions
    ) external returns (bool);

    /**
     * @notice Moves all tokens from the caller's account to `dst`.
     * @param dst The destination address.
     * @return bool true=success, otherwise a failure
     */
    function transferAll(address dst) external returns (bool);

    /**
     * @notice Moves all tokens from `src` account to `dst`.
     * @param src The source address which approved the msg.sender to spend
     * @param dst The destination address.
     * @return bool true=success, otherwise a failure
     */
    function transferAllFrom(address src, address dst) external returns (bool);

    /**
     * @notice Sender redeems rTokens in exchange for the underlying asset
     * @param redeemTokens The number of rTokens to redeem into underlying
     * @return bool true=success, otherwise a failure
     */
    function redeem(uint256 redeemTokens) external returns (bool);

    /**
     * @notice Sender redeems all rTokens in exchange for the underlying asset
     * @return bool true=success, otherwise a failure
     */
    function redeemAll() external returns (bool);

    /**
     * @notice Sender redeems rTokens in exchange for the underlying asset then immediately transfer them to a differen user
     * @param redeemTo Destination address to send the redeemed tokens to
     * @param redeemTokens The number of rTokens to redeem into underlying
     * @return bool true=success, otherwise a failure
     */
    function redeemAndTransfer(address redeemTo, uint256 redeemTokens)
        external
        returns (bool);

    /**
     * @notice Sender redeems all rTokens in exchange for the underlying asset then immediately transfer them to a differen user
     * @param redeemTo Destination address to send the redeemed tokens to
     * @return bool true=success, otherwise a failure
     */
    function redeemAndTransferAll(address redeemTo) external returns (bool);

    /**
     * @notice Create a new Hat
     * @param recipients List of beneficial recipients
     * @param proportions Relative proportions of benefits received by the recipients
     * @param doChangeHat Should the hat of the `msg.sender` be switched to the new one
     * @return uint256 ID of the newly creatd Hat.
     */
    function createHat(
        address[] calldata recipients,
        uint32[] calldata proportions,
        bool doChangeHat
    ) external returns (uint256 hatID);

    /**
     * @notice Change the hat for `msg.sender`
     * @param hatID The id of the Hat
     * @return bool true=success, otherwise a failure
     */
    function changeHat(uint256 hatID) external returns (bool);

    /**
     * @notice pay interest to the owner
     * @param owner Account owner address
     * @return bool true=success, otherwise a failure
     *
     * Anyone can trigger the interest distribution on behalf of the recipient,
     * due to the fact that the recipient can be a contract code that has not
     * implemented the interaction with the rToken contract internally`.
     *
     * A interest lock-up period may apply, in order to mitigate the "hat
     * inheritance scam".
     */
    function payInterest(address owner) external returns (bool);

    ////////////////////////////////////////////////////////////////////////////
    // Essential info views
    ////////////////////////////////////////////////////////////////////////////
    /**
     * @notice Get the maximum hatID in the system
     */
    function getMaximumHatID() external view returns (uint256 hatID);

    /**
     * @notice Get the hatID of the owner and the hat structure
     * @param owner Account owner address
     * @return hatID Hat ID
     * @return recipients Hat recipients
     * @return proportions Hat recipient's relative proportions
     */
    function getHatByAddress(address owner)
        external
        view
        returns (
            uint256 hatID,
            address[] memory recipients,
            uint32[] memory proportions
        );

    /**
     * @notice Get the hat structure
     * @param hatID Hat ID
     * @return recipients Hat recipients
     * @return proportions Hat recipient's relative proportions
     */
    function getHatByID(uint256 hatID)
        external
        view
        returns (address[] memory recipients, uint32[] memory proportions);

    /**
     * @notice Amount of saving assets given to the recipient along with the
     *         loans.
     * @param owner Account owner address
     */
    function receivedSavingsOf(address owner)
        external
        view
        returns (uint256 amount);

    /**
     * @notice Amount of token loaned to the recipient along with the savings
     *         assets.
     * @param owner Account owner address
     * @return amount
     */
    function receivedLoanOf(address owner)
        external
        view
        returns (uint256 amount);

    /**
     * @notice Get the current interest balance of the owner.
               It is equivalent of: receivedSavings - receivedLoan - freeBalance
     * @param owner Account owner address
     * @return amount
     */
    function interestPayableOf(address owner)
        external
        view
        returns (uint256 amount);

    ////////////////////////////////////////////////////////////////////////////
    // statistics views
    ////////////////////////////////////////////////////////////////////////////
    /**
     * @notice Get the current saving strategy contract
     * @return Saving strategy address
     */
    function getCurrentSavingStrategy() external view returns (address);

    /**
    * @notice Get saving asset balance for specific saving strategy
    * @return rAmount Balance in redeemable amount
    * @return sOriginalAmount Balance in native amount of the strategy
    */
    function getSavingAssetBalance()
        external
        view
        returns (uint256 rAmount, uint256 sOriginalAmount);

    /**
    * @notice Get global stats
    * @return global stats
    */
    function getGlobalStats() external view returns (GlobalStats memory);

    /**
    * @notice Get account stats
    * @param owner Account owner address
    * @return account stats
    */
    function getAccountStats(address owner)
        external
        view
        returns (AccountStatsView memory);

    /**
    * @notice Get hat stats
    * @param hatID Hat ID
    * @return hat stats
    */
    function getHatStats(uint256 hatID)
        external
        view
        returns (HatStatsView memory);

    ////////////////////////////////////////////////////////////////////////////
    // Events
    ////////////////////////////////////////////////////////////////////////////
    /**
     * @notice Event emitted when loans get transferred
     */
    event LoansTransferred(
        address indexed owner,
        address indexed recipient,
        uint256 indexed hatId,
        bool isDistribution,
        uint256 redeemableAmount,
        uint256 internalSavingsAmount);

    /**
     * @notice Event emitted when interest paid
     */
    event InterestPaid(address indexed recipient, uint256 amount);

    /**
     * @notice A new hat is created
     */
    event HatCreated(uint256 indexed hatID);

    /**
     * @notice Hat is changed for the account
     */
    event HatChanged(address indexed account, uint256 indexed oldHatID, uint256 indexed newHatID);
}
