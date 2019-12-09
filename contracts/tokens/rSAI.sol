/**
 * Because the use of ABIEncoderV2 , the pragma should be locked above 0.5.10 ,
 * as there is a known bug in array storage:
 * https://blog.ethereum.org/2019/06/25/solidity-storage-array-bugs/
 */
pragma solidity >=0.5.10 <0.6.0;
pragma experimental ABIEncoderV2;

import { RToken } from "../RToken.sol";

/**
 * @notice RToken instantiation for rSAI (Redeemable SAI)
 */
contract rSAI is RToken {

    function updateTokenInfo()
        external
        onlyOwner {
        name = "Redeemable SAI";
        symbol = "rSAI";
    }

}
