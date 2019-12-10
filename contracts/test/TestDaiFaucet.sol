pragma solidity ^0.5.0;

/**
 * @dev Some testnet DAI use this interface to mint test DAIs
 */
contract TestDaiFaucet {
    function allocateTo(address, uint256) public payable;
}
