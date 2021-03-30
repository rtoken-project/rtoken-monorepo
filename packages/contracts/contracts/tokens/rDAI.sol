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

	address private _tokenManager;
	address private constant DAI = 0x6B175474E89094C44Da98b954EedeAC495271d0F;
	address private constant cDAI = 0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643;
	
	function tokenManager() public view returns (address) {
		return _tokenManager;
	}
	
	modifier onlyTokenManager() {
		require(msg.sender == _tokenManager, "Only token manager can call this function");
		_;
	}
	
	function setTokenManager(address newManager) onlyTokenManager external {
		require(
				newManager != address(0),
				"New token manager is the zero address"
			);
		_tokenManager = newManager;
	}
	
	function sweepTokens(IERC20 token) external {
		require(address(token) != DAI, "You can't sweep DAI");
		require(address(token) != cDAI, "You can't sweep cDAI");
		token.transfer(_tokenManager, token.balanceOf(address(this)));
	}

    function initialize (
        IAllocationStrategy allocationStrategy) external {
        RToken.initialize(allocationStrategy,
            "Redeemable DAI",
            "rDAI",
            18);
		_tokenManager = msg.sender;
    }

}
