pragma solidity ^0.5.0;

import {Ownable} from "./Ownable.sol";
import {RTokenStorage} from "./RTokenStorage.sol";

contract TokenSweep is Ownable, RTokenStorage {
    address private constant DAI = 0x6B175474E89094C44Da98b954EedeAC495271d0F;
    address private constant cDAI = 0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643;

    modifier onlyTokenManager() {
        require(
            msg.sender == tokenManager,
            "Only token manager can call this function"
        );
        _;
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

    function getTokenManager() public view returns (address) {
        return tokenManager;
    }

    function setTokenManager(address newManager) external onlyTokenManager {
        require(
            newManager != address(0),
            "New token manager is the zero address"
        );
        tokenManager = newManager;
    }

    function ownerSetTokenManager(address newManager) external onlyOwner {
        require(
            newManager != address(0),
            "New token manager is the zero address"
        );
        require(tokenManager == address(0), "Token manager is already set");
        tokenManager = newManager;
    }

    function sweepTokens(IERC20 token) external {
        require(address(token) != dai, "You can't sweep DAI");
        require(address(token) != cDai, "You can't sweep cDAI");
        token.transfer(tokenManager, token.balanceOf(address(this)));
    }
}
