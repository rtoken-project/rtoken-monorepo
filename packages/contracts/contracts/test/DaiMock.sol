pragma solidity ^0.5.8;

import {ERC20Detailed} from "@openzeppelin/contracts/token/ERC20/ERC20Detailed.sol";
import {ERC20Mintable} from "@openzeppelin/contracts/token/ERC20/ERC20Mintable.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";


contract DaiMock is ERC20, ERC20Detailed, ERC20Mintable {

    constructor(string memory name,string memory symbol,uint8 decimals) public 
    ERC20Detailed(name,symbol,decimals) {

    }


}
