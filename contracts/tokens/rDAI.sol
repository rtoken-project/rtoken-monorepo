/**
 * Because the use of ABIEncoderV2 , the pragma should be locked above 0.5.10 ,
 * as there is a known bug in array storage:
 * https://blog.ethereum.org/2019/06/25/solidity-storage-array-bugs/
 */
pragma solidity >=0.5.10 <0.6.0;
pragma experimental ABIEncoderV2;

import { RToken, IAllocationStrategy } from "../RToken.sol";

/**
 * @notice RToken instantiation for rSAI (Redeemable SAI)
 */
contract rDAI is RToken {

    function initialize (
        IAllocationStrategy allocationStrategy) external {
        RToken.initialize(allocationStrategy,
            "Redeemable DAI",
            "rDAI",
            18);
    }

}
