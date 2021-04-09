pragma solidity ^0.5.0;

import {Ownable} from "./Ownable.sol";
import {RTokenStorage} from "./RTokenStorage.sol";
import {IERC20} from "./IRToken.sol";

contract TokenSweep is RTokenStorage, Ownable {
    address private constant DAI = 0x6B175474E89094C44Da98b954EedeAC495271d0F;
    address private constant cDAI = 0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643;

    modifier onlyTokenManager() {
        require(
            msg.sender == tokenManager,
            "Only token manager can call this function"
        );
        _;
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
        require(tokenManager == address(0), "Token manager is already set");
        require(
            newManager != address(0),
            "New token manager is the zero address"
        );
        tokenManager = newManager;
    }

    function sweepERC20(IERC20 token) external {
        require(address(token) != DAI, "You can't sweep the underlying token");
        require(address(token) != cDAI, "You can't sweep the allocation token");
        token.transfer(tokenManager, token.balanceOf(address(this)));
    }
}
