/**
 * In order to build a Aragon App, it is required to have a solidity requirement
 * that is without ABIEncoderV2.
 */
pragma solidity >= 0.4.24;

/**
 * IRTokenAdmin interface
 */
interface IRTokenAdmin {

    /**
     * @notice Get current owner
     */
    function owner() external view returns (address);

    /**
     * @notice Transfers ownership of the contract to a new account (`newOwner`).
     *
     * To be implemented by Ownable
     */
    function transferOwnership(address newOwner) external;

    /**
    * @notice Get the current allocation strategy
    */
    function getCurrentAllocationStrategy()
        external view returns (address allocationStrategy);

    /**
    * @notice Change allocation strategy for the contract instance
    * @param allocationStrategy Allocation strategy instance
    */
    function changeAllocationStrategy(address allocationStrategy)
        external;

    /**
     * @notice Change hat for the contract address
     * @param contractAddress contract address
     * @param hatID Hat ID
     */
    function changeHatFor(address contractAddress, uint256 hatID)
        external;

    /**
     * @notice Update the rToken logic contract code
     */
    function updateCode(address newCode) external;

    /**
     * @notice Code updated event
     */
    event CodeUpdated(address newCode);

    /**
     * @notice Allocation strategy changed event
     * @param strategy New strategy address
     * @param conversionRate New saving asset conversion rate
     */
    event AllocationStrategyChanged(address strategy, uint256 conversionRate);
}
