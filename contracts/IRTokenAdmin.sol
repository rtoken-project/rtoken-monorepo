pragma solidity >= 0.4.28;

import {Ownable} from './Ownable.sol';
import {IAllocationStrategy} from './IAllocationStrategy.sol';

/**
 * IRTokenAdmin interface
 *
 * In order to build a Aragon App, it is required to have a solidity requirement
 * that is without ABIEncoderV2.
 */
contract IRTokenAdmin is Ownable {
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
