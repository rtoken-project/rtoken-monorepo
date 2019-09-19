pragma solidity ^0.5.8;

contract Structs {

    struct AccountStats {
        uint256 cumulativeInterest;
    }

    /**
     * @notice Hat structure describes who are the recipients of the interest
     *
     * To be a valid hat structure:
     *   - at least one recipient
     *   - recipients.length == proportions.length
     *   - each value in proportions should be greater than 0
     */
    struct Hat {
        address[] recipients;
        uint32[] proportions;
    }

    /// @dev Account structure
    struct Account {
        uint256 hatID;
        uint256 rAmount;
        uint256 rInterest;
        mapping(address => uint256) lRecipients;
        uint256 lDebt;
        uint256 sInternalAmount;
        AccountStats stats;
    }
}
