pragma solidity >=0.4.21 <0.6.0;
import {IERC20} from "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import {SafeMath} from "openzeppelin-solidity/contracts/math/SafeMath.sol";
import {ReentrancyGuard} from "openzeppelin-solidity/contracts/utils/ReentrancyGuard.sol";
import {CErc20Interface} from '../compound/contracts/CErc20Interface.sol';

contract RToken is IERC20, ReentrancyGuard {

    using SafeMath for uint256;

    /**
     * @dev Compound token associated with the rToken
     */
    CErc20Interface cToken;

    /**
     * @dev Approved token transfer amounts on behalf of others
     */
    mapping(address => mapping(address => uint256)) transferAllowances;

    /**
     * @dev Hat structure describes who are the recipients of the interest
     */
    struct Hat {
        address[] recipients;
        uint256[] proportions;
    }

    /**
     * @dev Hat list
     */
    Hat[] hats;

    /**
     * @dev Account structure
     */
    struct Account {
        uint256 hatID;
        uint256 rAmount;
        mapping (address => uint256) cRecipients;
        uint256 cAmount;
    }

    /**
     * @dev Account mapping
     */
    mapping (address => Account) accounts;

    /**
     * @dev Create rToken linked with cToken at `cToken_`
     */
    constructor (CErc20Interface cToken_) public {
        cToken = cToken_;
        // special hat: hatID = 0
        hats.push(Hat(new address[](0), new uint256[](0)));
    }

    //
    // ERC20 Interface
    //

    /**
     * @notice EIP-20 token name for this token
     */
    string public name = "Redeemable DAI (rDAI)";

    /**
     * @notice EIP-20 token symbol for this token
     */
    string public symbol = "rDAI";

    /**
     * @notice EIP-20 token decimals for this token
     */
    uint256 public decimals = 18;

     /**
      * @notice Total number of tokens in circulation
      */
     uint256 public totalSupply;

    /**
     * @dev Returns the amount of tokens owned by `account`.
     */
    function balanceOf(address owner) external view returns (uint256) {
        return accounts[owner].rAmount;
    }

    /**
     * @notice Moves `amount` tokens from the caller's account to `recipient`.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * Emits a `Transfer` event.
     */
    function transfer(address dst, uint256 amount) external nonReentrant returns (bool) {
        return transferTokens(msg.sender, msg.sender, dst, amount);
    }

    /**
     * @notice Returns the remaining number of tokens that `spender` will be
     * allowed to spend on behalf of `owner` through `transferFrom`. This is
     * zero by default.
     *
     * This value changes when `approve` or `transferFrom` are called.
     */
    function allowance(address owner, address spender) external view returns (uint256) {
        return transferAllowances[owner][spender];
    }

    /**
     * @notice Sets `amount` as the allowance of `spender` over the caller's tokens.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * > Beware that changing an allowance with this method brings the risk
     * that someone may use both the old and the new allowance by unfortunate
     * transaction ordering. One possible solution to mitigate this race
     * condition is to first reduce the spender's allowance to 0 and set the
     * desired value afterwards:
     * https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729
     *
     * Emits an `Approval` event.
     */
    function approve(address spender, uint256 amount) external returns (bool) {
        address src = msg.sender;
        transferAllowances[src][spender] = amount;
        emit Approval(src, spender, amount);
        return true;
    }

    /**
     * @notice Moves `amount` tokens from `sender` to `recipient` using the
     * allowance mechanism. `amount` is then deducted from the caller's
     * allowance.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * Emits a `Transfer` event.
     */
    function transferFrom(address src, address dst, uint256 amount) external nonReentrant returns (bool) {
        return transferTokens(msg.sender, src, dst, amount);
    }

    /**
     * @notice Transfer `tokens` tokens from `src` to `dst` by `spender`
     * @dev Called by both `transfer` and `transferFrom` internally
     * @param spender The address of the account performing the transfer
     * @param src The address of the source account
     * @param dst The address of the destination account
     * @param tokens The number of tokens to transfer
     * @return Whether or not the transfer succeeded
     */
    function transferTokens(address spender, address src, address dst, uint256 tokens) internal returns (bool) {
        require(src != dst, "src should not equal dst");

        /* Get the allowance, infinite for the account owner */
        uint256 startingAllowance = 0;
        if (spender == src) {
            startingAllowance = uint256(-1);
        } else {
            startingAllowance = transferAllowances[src][spender];
        }

        /* Do the calculations, checking for {under,over}flow */
        uint256 allowanceNew = startingAllowance.sub(tokens);
        uint256 srcTokensNew = accounts[src].rAmount.sub(tokens);
        uint256 dstTokensNew = accounts[dst].rAmount.add(tokens);

        /////////////////////////
        // EFFECTS & INTERACTIONS
        // (No safe failures beyond this point)

        accounts[src].rAmount = srcTokensNew;
        accounts[dst].rAmount = dstTokensNew;

        /* Eat some of the allowance (if necessary) */
        if (startingAllowance != uint256(-1)) {
            transferAllowances[src][spender] = allowanceNew;
        }

        /* We emit a Transfer event */
        emit Transfer(src, dst, tokens);

        return true;
    }


    //
    // rToken interface
    //

    /**
     * @notice Sender supplies assets into the market and receives rTokens in exchange
     * @dev Invest underlying assets immediately
     * @param mintAmount The amount of the underlying asset to supply
     * @return uint 0=success, otherwise a failure
     */
    function mint(uint256 mintAmount) external nonReentrant returns (bool) {
        IERC20 token = IERC20(cToken.underlying());
        require(token.allowance(msg.sender, address(this)) >= mintAmount, "Not enough allowance");

        // mint c tokens
        token.transferFrom(msg.sender, address(this), mintAmount);
        token.approve(address(cToken), mintAmount);
        uint256 cNewAmount = cToken.mint(mintAmount);

        // update Account r balances
        accounts[msg.sender].rAmount = accounts[msg.sender].rAmount.add(mintAmount);
        totalSupply = totalSupply.add(mintAmount);

        // update Account c balances
        Hat storage hat = hats[accounts[msg.sender].hatID];

        emit Mint(msg.sender, mintAmount);
    }

    /**
     * @notice Sender redeems rTokens in exchange for the underlying asset
     * @dev Withdraw equal amount of initially supplied underlying assets
     * @param redeemTokens The number of cTokens to redeem into underlying
     * @return uint 0=success, otherwise a failure
     */
    function redeem(uint256 redeemTokens) external nonReentrant returns (bool) {

    }

    function createHat(
        address[] calldata recipients,
        uint256[] calldata proportions,
        bool doChangeHat) external returns (uint256 hatID) {

    }

    function changeHat(uint256 hatID) external nonReentrant {

    }

    function getHat() external view returns (uint256 hatID) {

    }

    function describeHat(uint256 hatID) external view returns (
        address[] memory recipients,
        uint256[] memory proportions) {

    }

    function interestBalanceOf(address owner) external view returns (uint256 amount){
        //Wallet storage wallet = wallets[owner];
    }

    function withdrawInterest() external nonReentrant returns (bool) {

    }


    /**
     * @notice Event emitted when tokens are minted
     */
    event Mint(address minter, uint256 mintAmount);

    /**
     * @notice Event emitted when tokens are redeemed
     */
    event Redeem(address redeemer, uint256 redeemAmount);

    /**
     * @notice A new hat is created
     */
    event HatCreated(uint256 indexed hatID);

    /**
     * @notice Hat is changed for the account
     */
    event HatChanged(address account, uint256 indexed hatID);
}
