
pragma solidity ^0.5.8;

contract LendingPoolAddressesProviderMock {

	address lendingPool;
	bytes32 private constant LENDING_POOL = "LENDING_POOL";

	function getLendingPool() public view returns (address) {
        return getAddress(LENDING_POOL);
    }

    function setLendingPool(address _lendingPool) public {
    	require(_lendingPool != address(0));
    	lendingPool = _lendingPool;
    }

    function getAddress(bytes32 _key) public view returns(address) {
    	if(_key == LENDING_POOL) return lendingPool;
    	else return address(0x0);
    }
}
