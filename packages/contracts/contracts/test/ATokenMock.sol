pragma solidity ^0.5.8;

import {MinterRole} from "@openzeppelin/contracts/access/roles/MinterRole.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";

interface ERC20Mintable {
	function mint(address accounts, uint ammount) external;
}

contract ATokenMock is MinterRole {

	using SafeMath for uint;

	event Transfer(address indexed from, address indexed to, uint value);
    event Approval(address indexed owner, address indexed spender, uint value);

    mapping (address => uint) public _balances;
    mapping (address => mapping (address => uint)) public _allowances;
    uint public _totalSupply;
    string public _name;
    string public _symbol;
    uint8 public _decimals;


	address public underlyingAssetAddress;
	uint public rateNumerator = 1000;   // set the return rate to 1% per block 
	uint public rateDenominator = 100000; // rate denominator is equal 100 * rateNumerator

	mapping(address=>uint ) public _balancesLastUpdate;

	constructor(string memory __name, string memory __symbol, uint8 __decimals,address _underlyingAssetAddress) 
		public 
	{
		_name = __name;
    	_symbol = __symbol;
    	_decimals = __decimals;
		underlyingAssetAddress = _underlyingAssetAddress;
	}

	function redeem(uint _amount) public {

        if(_balancesLastUpdate[msg.sender] == 0) _balancesLastUpdate[msg.sender] = block.number;

		_balances[msg.sender] = balanceOfNonView(msg.sender).sub(_amount);
		_totalSupply = _totalSupply.sub(_amount);

		// instead of transfer mint is used since it just a mock contract.
		ERC20Mintable(underlyingAssetAddress).mint(msg.sender,_amount);
		emit Transfer(msg.sender,address(0x0),_amount);
	}

	function mint(address _to, uint _amount) onlyMinter public returns(bool){
		
		if(_balancesLastUpdate[_to] == 0) _balancesLastUpdate[_to] = block.number;

		_balances[_to] = balanceOfNonView(_to).add(_amount);
		_totalSupply = _totalSupply.add(_amount);
		emit Transfer(address(0x0),_to,_amount);
		return true;
	}

	function balanceOfNonView(address _addr) internal returns(uint){
		uint earnings_rate = block.number.sub(_balancesLastUpdate[_addr]).mul(rateNumerator);
		uint balance = _balances[_addr];
		uint earnings = balance.mul(earnings_rate).div(rateDenominator);

		_totalSupply = _totalSupply.add(earnings);
		
		_balancesLastUpdate[_addr] = block.number;
		return balance.add(earnings);
	}

	function balanceOf(address _addr) public view returns(uint){
		uint earnings_rate = block.number.sub(_balancesLastUpdate[_addr]).mul(rateNumerator);
		uint balance = _balances[_addr];
		uint earnings = balance.mul(earnings_rate).div(rateDenominator);
		return balance.add(earnings);
	}


    function transfer(address recipient, uint amount) public returns (bool) {
        _transfer(msg.sender, recipient, amount);
        return true;
    }

    function allowance(address owner, address spender) public view returns (uint) {
        return _allowances[owner][spender];
    }

    function approve(address spender, uint amount) public returns (bool) {
        _approve(msg.sender, spender, amount);
        return true;
    }


    function transferFrom(address sender, address recipient, uint amount) public returns (bool) {
        _transfer(sender, recipient, amount);
        _approve(sender, msg.sender, _allowances[sender][msg.sender].sub(amount, "ERC20: transfer amount exceeds allowance"));
        return true;
    }


    function increaseAllowance(address spender, uint addedValue) public returns (bool) {
        _approve(msg.sender, spender, _allowances[msg.sender][spender].add(addedValue));
        return true;
    }

    function decreaseAllowance(address spender, uint subtractedValue) public returns (bool) {
        _approve(msg.sender, spender, _allowances[msg.sender][spender].sub(subtractedValue, "ERC20: decreased allowance below zero"));
        return true;
    }

    function _transfer(address sender, address recipient, uint amount) internal {
        require(sender != address(0), "ERC20: transfer from the zero address");
        require(recipient != address(0), "ERC20: transfer to the zero address");

        _balances[sender] = balanceOfNonView(sender).sub(amount, "ERC20: transfer amount exceeds balance");
        _balances[recipient] = balanceOfNonView(recipient).add(amount);
        emit Transfer(sender, recipient, amount);
    }


    function _approve(address owner, address spender, uint amount) internal {
        require(owner != address(0), "ERC20: approve from the zero address");
        require(spender != address(0), "ERC20: approve to the zero address");

        _allowances[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }

    function name() public view returns (string memory) {
        return _name;
    }

    function symbol() public view returns (string memory) {
        return _symbol;
    }

    function decimals() public view returns (uint8) {
        return _decimals;
    }
}