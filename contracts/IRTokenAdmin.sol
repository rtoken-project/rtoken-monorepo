/**
 * In order to build a Aragon App, it is required to have a solidity requirement
 * that is without ABIEncoderV2.
 */
pragma solidity >= 0.4.24;

import {IAllocationStrategy} from "./IAllocationStrategy.sol";

/**
 * IRTokenAdmin interface
 */
interface IRTokenAdmin {

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
        external view returns (IAllocationStrategy allocationStrategy);

    /**
    * @notice Change allocation strategy for the contract instance
    * @param allocationStrategy Allocation strategy instance
    */
    function changeAllocationStrategy(IAllocationStrategy allocationStrategy)
        external;

    /**
    * @notice Change hat for the contract address
    * @param contractAddress contract address
    * @param hatID Hat ID
    */
    function changeHatFor(address contractAddress, uint256 hatID)
        external;
}
