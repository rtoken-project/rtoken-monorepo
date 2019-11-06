/**
 * Because the use of ABIEncoderV2 , the pragma should be locked above 0.5.10 ,
 * as there is a known bug in array storage:
 * https://blog.ethereum.org/2019/06/25/solidity-storage-array-bugs/
 */
pragma solidity >=0.5.10 <0.6.0;
pragma experimental ABIEncoderV2;

import {RTokenStructs} from "./RTokenStructs.sol";
import {IERC20} from "./IRToken.sol";
import {IAllocationStrategy} from "./IAllocationStrategy.sol";

contract RTokenStorage is RTokenStructs, IERC20 {
    /* WARNING: NEVER RE-ORDER VARIABLES! Always double-check that new variables are added APPEND-ONLY. Re-ordering variables can permanently BREAK the deployed proxy contract.*/
    address public _owner;
    bool public initialized;
    /// @dev counter to allow mutex lock with only one SSTORE operation
    uint256 public _guardCounter;
    /**
     * @notice EIP-20 token name for this token
     */
    string public name;
    /**
     * @notice EIP-20 token symbol for this token
     */
    string public symbol;
    /**
     * @notice EIP-20 token decimals for this token
     */
    uint256 public decimals;
    /**
     * @notice Total number of tokens in circulation
     */
    uint256 public totalSupply;
    /// @dev Current saving strategy
    IAllocationStrategy public ias;
    /// @dev Underlying token
    IERC20 public token;
    /// @dev Saving assets original amount
    /// This amount is in the same unit used in allocation strategy
    uint256 public savingAssetOrignalAmount;
    /// @dev Saving asset original to internal amount conversion rate.
    ///      - It has 18 decimals
    ///      - It starts with value 1.
    ///      - Each strategy switching results a new conversion rate
    ///
    /// NOTE:
    ///
    /// 1. The reason there is an exchange rate is that, each time the
    ///    allocation strategy is switched, the unit of the original amount gets
    ///    changed, it is impossible to change all the internal savings
    ///    accounting entries for all accounts, hence instead a conversaion rate
    ///    is used to simplify the process.
    /// 2. internalSavings == originalSavings * savingAssetConversionRate
    uint256 public savingAssetConversionRate;
    /// @dev Approved token transfer amounts on behalf of others
    mapping(address => mapping(address => uint256)) public transferAllowances;
    /// @dev Hat list
    Hat[] internal hats;
    /// @dev Account mapping
    mapping(address => Account) public accounts;
    /// @dev AccountStats mapping
    mapping(address => AccountStatsStored) public accountStats;
    /// @dev HatStats mapping
    mapping(uint256 => HatStatsStored) public hatStats;
}
