pragma solidity >=0.5.10 <0.6.0;
pragma experimental ABIEncoderV2;

import {RToken} from '../RToken.sol';

/**
 * @dev Test RTokenStorage Layout
 */
contract RTokenStorageLayoutTester is RToken {
    function validate() public pure {
        uint256 slot;
        uint256 offset;

        // address public _owner;
        assembly { slot:= _owner_slot offset := _owner_offset }
        require (slot == 0 && offset == 0, "_owner changed location");

        // bool public initialized;
        assembly { slot:= initialized_slot offset := initialized_offset }
        require (slot == 0 && offset == 20, "initialized changed location");

        // uint256 public _guardCounter;
        assembly { slot:= _guardCounter_slot offset := _guardCounter_offset }
        require (slot == 1 && offset == 0, "_guardCounter changed location");

        // string public name;
        assembly { slot:= name_slot offset := name_offset }
        require (slot == 2 && offset == 0, "name changed location");

        // string public symbol;
        assembly { slot:= symbol_slot offset := symbol_offset }
        require (slot == 3 && offset == 0, "symbol changed location");

        // string public decimals;
        assembly { slot:= decimals_slot offset := decimals_offset }
        require (slot == 4 && offset == 0, "decimals changed location");

        // string public totalSupply;
        assembly { slot:= totalSupply_slot offset := totalSupply_offset }
        require (slot == 5 && offset == 0, "totalSupply changed location");

        // string public ias;
        assembly { slot:= ias_slot offset := ias_offset }
        require (slot == 6 && offset == 0, "ias changed location");

        // string public token;
        assembly { slot:= token_slot offset := token_offset }
        require (slot == 7 && offset == 0, "token changed location");

        // string public savingAssetOrignalAmount;
        assembly { slot:= savingAssetOrignalAmount_slot offset := savingAssetOrignalAmount_offset }
        require (slot == 8 && offset == 0, "savingAssetOrignalAmount changed location");

        // string public savingAssetConversionRate;
        assembly { slot:= savingAssetConversionRate_slot offset := savingAssetConversionRate_offset }
        require (slot == 9 && offset == 0, "savingAssetOrignalAmount changed location");

        // string public transferAllowances;
        assembly { slot:= transferAllowances_slot offset := transferAllowances_offset }
        require (slot == 10 && offset == 0, "savingAssetOrignalAmount changed location");

        // string public hats;
        assembly { slot:= hats_slot offset := hats_offset }
        require (slot == 11 && offset == 0, "hats changed location");

        // string public accounts;
        assembly { slot:= accounts_slot offset := accounts_offset }
        require (slot == 12 && offset == 0, "accounts changed location");

        /* Account storage account = accounts[address(0)];
        assembly { slot:= account.hatID_slot offset := account.hatID_offset }
        require (slot == 12 && offset == 0, "accounts changed location"); */

        // string public accountStats;
        assembly { slot:= accountStats_slot offset := accountStats_offset }
        require (slot == 13 && offset == 0, "accountStats changed location");

        // string public hatStats;
        assembly { slot:= hatStats_slot offset := hatStats_offset }
        require (slot == 14 && offset == 0, "hatStats changed location");
    }
}
