/**
 * Because the use of ABIEncoderV2 , the pragma should be locked above 0.5.10 ,
 * as there is a known bug in array storage:
 * https://blog.ethereum.org/2019/06/25/solidity-storage-array-bugs/
 */
pragma solidity >=0.5.10 <0.6.0;
pragma experimental ABIEncoderV2;

import { RToken, IAllocationStrategy } from "../RToken.sol";
import { IERC20 } from "../IRToken.sol";

/**
 * @notice RToken instantiation for rSAI (Redeemable SAI)
 */
contract rDAI is RToken {
	
	function getTokenManager() public view returns (address) {
		return tokenManager;
	}
	
	modifier onlyTokenManager() {
		require(msg.sender == tokenManager, "Only token manager can call this function");
		_;
	}
	
	function setTokenManager(address newManager) onlyTokenManager external {
		require(
				newManager != address(0),
				"New token manager is the zero address"
			);
		tokenManager = newManager;
	}
	
	function ownerSetTokenManager(address newManager) onlyOwner external {
		require(
				newManager != address(0),
				"New token manager is the zero address"
			);
		require(
				tokenManager == address(0),
				"Token manager is already set"
			);
		tokenManager = newManager;		
	}
	
	function sweepTokens(IERC20 token) external {
		require(address(token) != dai, "You can't sweep DAI");
		require(address(token) != cDai, "You can't sweep cDAI");
		token.transfer(tokenManager, token.balanceOf(address(this)));
	}

    function initialize (
        IAllocationStrategy allocationStrategy) external {
        RToken.initialize(allocationStrategy,
            "Redeemable DAI",
            "rDAI",
            18);
    }

	constructor(address _dai, address _cdai) public {
		dai = _dai;
		cDai = _cdai;
	}
}
