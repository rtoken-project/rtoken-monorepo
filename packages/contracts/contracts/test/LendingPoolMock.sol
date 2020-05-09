pragma solidity ^0.5.0;


import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ATokenMock} from "./ATokenMock.sol";

contract LendingPoolMock {

    mapping(address=>address) reserve2AToken;

    function setAToken(address _reserve,address _atoken) public {
    	reserve2AToken[_reserve] = _atoken; 
    }

    function deposit(address _reserve, uint256 _amount, uint16 _referralCode)
        external
    {
        address atokenAddress = reserve2AToken[_reserve];
        if(atokenAddress==address(0)) return;
    	ERC20(_reserve).transferFrom(msg.sender,address(this),_amount);
    	ATokenMock aToken = ATokenMock(atokenAddress);
    	aToken.mint(msg.sender,_amount);
    }

}