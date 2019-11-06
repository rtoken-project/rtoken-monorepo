pragma solidity >=0.5.10 <0.6.0;

contract RTokenStructs {
    /**
     * @notice Global stats
     */
    struct GlobalStats {
        /// @notice Total redeemable tokens supply
        uint256 totalSupply;
        /// @notice Total saving assets in redeemable amount
        uint256 totalSavingsAmount;
    }


    /**
     * @notice Account stats stored
     */
    struct AccountStatsView {
        /// @notice Current hat ID
        uint256 hatID;
        /// @notice Current redeemable amount
        uint256 rAmount;
        /// @notice Interest portion of the rAmount
        uint256 rInterest;
        /// @notice Current loan debt amount
        uint256 lDebt;
        /// @notice Current internal savings amount
        uint256 sInternalAmount;
        /// @notice Interest payable
        uint256 rInterestPayable;
        /// @notice Cumulative interest generated for the account
        uint256 cumulativeInterest;
    }

    /**
     * @notice Account stats stored
     */
    struct AccountStatsStored {
        /// @notice Cumulative interest generated for the account
        uint256 cumulativeInterest;
    }

    /**
     * @notice Hat stats view
     */
    struct HatStatsView {
        /// @notice Number of addresses has the hat
        uint256 useCount;
        /// @notice Total net loans distributed through the hat
        uint256 totalLoans;
        /// @notice Total net savings distributed through the hat
        uint256 totalSavings;
    }

    /**
     * @notice Hat stats stored
     */
    struct HatStatsStored {
        /// @notice Number of addresses has the hat
        uint256 useCount;
        /// @notice Total net loans distributed through the hat
        uint256 totalLoans;
        /// @notice Total net savings distributed through the hat
        uint256 totalInternalSavings;
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
    }
}
