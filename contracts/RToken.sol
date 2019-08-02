pragma solidity >=0.4.21 <0.6.0;
import {IERC20} from "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import {SafeMath} from "openzeppelin-solidity/contracts/math/SafeMath.sol";
import {ReentrancyGuard} from "openzeppelin-solidity/contracts/utils/ReentrancyGuard.sol";
import {CErc20Interface} from '../compound/contracts/CErc20Interface.sol';

contract RToken is IERC20, ReentrancyGuard {

    using SafeMath for uint256;

    uint32 constant PROPORTION_BASE = 0xFFFFFFFF;

    //
    // public structures
    //

    /**
     * @notice Hat structure describes who are the recipients of the interest
     *
     * To be a valid hat structure:
     *   - at least one recipient
     *   - recipients.length == proportions.length
     *   - each value in proportions should be greater than 0
     */
    struct Hat {
        address[] recipients;
        uint32[] proportions;
    }

    /**
     * @notice Create rToken linked with cToken at `cToken_`
     */
    constructor (CErc20Interface cToken_) public {
        cToken = cToken_;
        // special hat aka. zero hat : hatID = 0
        hats.push(Hat(new address[](0), new uint32[](0)));
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
        return transferInternal(msg.sender, msg.sender, dst, amount);
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
        return transferInternal(msg.sender, src, dst, amount);
    }

    //
    // rToken interface
    //

    /**
     * @notice Sender supplies assets into the market and receives rTokens in exchange
     * @param mintAmount The amount of the underlying asset to supply
     * @return uint 0=success, otherwise a failure
     */
    function mint(uint256 mintAmount) external nonReentrant returns (bool) {
        mintInternal(mintAmount);
        return true;
    }

    /**
     * @notice Sender supplies assets into the market and receives rTokens in exchange
     *         Also setting the a new hat for the fresh account.
     * @param mintAmount The amount of the underlying asset to supply
     * @param proportions Relative proportions of benefits received by the recipients
     * @return uint 0=success, otherwise a failure
     */
    function mintWithNewHat(uint256 mintAmount,
        address[] calldata recipients,
        uint32[] calldata proportions) external nonReentrant returns (bool) {
        Account storage account = accounts[msg.sender];
        require(account.hatID == 0, "You already have a hat");

        uint256 hatID = createHatInternal(recipients, proportions);
        changeHatInternal(msg.sender, hatID);

        mintInternal(mintAmount);

        return true;
    }

    /**
     * @notice Sender redeems rTokens in exchange for the underlying asset
     * @dev Withdraw equal amount of initially supplied underlying assets
     * @param redeemTokens The number of rTokens to redeem into underlying
     * @return uint 0=success, otherwise a failure
     */
    function redeem(uint256 redeemTokens) external nonReentrant returns (bool) {
        redeemInternal(redeemTokens);
        return true;
    }

    /**
     * @notice Create a new Hat
     * @param recipients List of beneficial recipients
     * @param proportions Relative proportions of benefits received by the recipients
     * @param doChangeHat Should the hat of the `msg.sender` be switched to the new one
     */
    function createHat(
        address[] calldata recipients,
        uint32[] calldata proportions,
        bool doChangeHat) external returns (uint256 hatID) {
        hatID = createHatInternal(recipients, proportions);
        if (doChangeHat) {
            changeHatInternal(msg.sender, hatID);
        }
    }

    /**
     * @notice Change the hat for `msg.sender`
     * @param hatID The id of the Hat
     */
    function changeHat(uint256 hatID) external nonReentrant {
        changeHatInternal(msg.sender, hatID);
    }

    /**
     * @notice Get the hatID of the owner and the hat structure
     * @param owner Account owner address
     * @return hatID Hat ID
     * @return recipients Hat recipients
     * @return proportions Hat recipient's relative proportions
     */
    function getHatByAddress(address owner) external view returns (
        uint256 hatID,
        address[] memory recipients,
        uint32[] memory proportions) {
        hatID = accounts[owner].hatID;
        Hat memory hat = hats[hatID];
        recipients = hat.recipients;
        proportions = hat.proportions;
    }

    /**
     * @notice Get the hat structure
     * @param hatID Hat ID
     * @return recipients Hat recipients
     * @return proportions Hat recipient's relative proportions
     */
    function getHatByID(uint256 hatID) external view returns (
        address[] memory recipients,
        uint32[] memory proportions) {
        Hat memory hat = hats[hatID];
        recipients = hat.recipients;
        proportions = hat.proportions;
    }

    /**
     * @notice Amount of token received by the recipient for interest growth.
     *         Recipient cannot withdraw these tokens, instead recipient can only
     *         get interest that are generated by these tokens.
     */
    function receivedBalanceOf(address recipient) external view returns (uint256 amount) {
        Account storage account = accounts[recipient];
        uint256 rGross = account.cAmount
            .mul(cToken.exchangeRateStored())
            .div(10 ** 18);
        return rGross;
    }

    /**
     * @notice Get the current interest balance of the owner
     */
    function interestPayableOf(address recipient) external view returns (uint256 amount){
        Account storage account = accounts[recipient];
        uint256 rGross = account.cAmount
            .mul(cToken.exchangeRateStored())
            .div(10 ** 18);
        if (rGross > (account.rDebt + account.rInterestPaid)) {
            return rGross - account.rDebt - account.rInterestPaid;
        } else {
            // no interest accumulated yet or even negative interest rate!?
            return 0;
        }
    }

    /**
     * @notice pay interest to the recipient
     * @param recipient Recipient of the interest
     *
     * Anyone can trigger the interest distribution on behalf of the recipient,
     * due to the fact that the recipient can be a contract code that has not
     * implemented the interaction with the rToken contract internally`.
     *
     * A interest lock-up period may apply, in order to mitigate the "hat
     * inheritance scam".
     */
    function payInterest(address recipient) external nonReentrant returns (bool) {
        Account storage account = accounts[recipient];

        cToken.accrueInterest();

        uint256 rGross = account.cAmount
            .mul(cToken.exchangeRateStored())
            .div(10 ** 18);

        if (rGross > account.rDebt + account.rInterestPaid) {
            uint256 interestAmount = rGross - account.rDebt - account.rInterestPaid;
            account.rInterestPaid = account.rInterestPaid.add(interestAmount);
            account.rAmount = account.rAmount.add(interestAmount);
            totalSupply = totalSupply.add(interestAmount);
            emit InterestPaid(recipient, interestAmount);
        }
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
     * @notice Event emitted when interest paid
     */
    event InterestPaid(address recipient, uint256 interestAmount);

    /**
     * @notice A new hat is created
     */
    event HatCreated(uint256 indexed hatID);

    /**
     * @notice Hat is changed for the account
     */
    event HatChanged(address account, uint256 indexed hatID);

    //
    // internal
    //

    /**
     * @dev Compound token associated with the rToken
     */
    CErc20Interface cToken;

    /**
     * @dev Approved token transfer amounts on behalf of others
     */
    mapping(address => mapping(address => uint256)) transferAllowances;

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
        uint256 rDebt;
        uint256 rInterestPaid;
        mapping (address => uint256) rRecipients;
        uint256 cAmount;
    }

    /**
     * @dev Account mapping
     */
    mapping (address => Account) accounts;

    /**
     * @dev Transfer `tokens` tokens from `src` to `dst` by `spender`
            Called by both `transfer` and `transferFrom` internally
     * @param spender The address of the account performing the transfer
     * @param src The address of the source account
     * @param dst The address of the destination account
     * @param tokens The number of tokens to transfer
     * @return Whether or not the transfer succeeded
     */
    function transferInternal(address spender, address src, address dst, uint256 tokens) internal returns (bool) {
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

        // apply hat inheritance rule
        if (accounts[src].hatID != 0 && accounts[dst].hatID == 0) {
            changeHatInternal(dst, accounts[src].hatID);
        }

        accounts[src].rAmount = srcTokensNew;
        accounts[dst].rAmount = dstTokensNew;

        /* Eat some of the allowance (if necessary) */
        if (startingAllowance != uint256(-1)) {
            transferAllowances[src][spender] = allowanceNew;
        }

        // rRecipients adjustments
        uint256 cAmountCollected = estimateAndRecollect(src, tokens);
        distribute(dst, tokens, cAmountCollected);

        /* We emit a Transfer event */
        emit Transfer(src, dst, tokens);

        return true;
    }

    /**
     * @dev Sender supplies assets into the market and receives rTokens in exchange
     * @dev Invest into underlying assets immediately
     * @param mintAmount The amount of the underlying asset to supply
     */
    function mintInternal(uint256 mintAmount) internal {
        IERC20 token = IERC20(cToken.underlying());
        require(token.allowance(msg.sender, address(this)) >= mintAmount, "Not enough allowance");

        Account storage account = accounts[msg.sender];

        // mint c tokens
        token.transferFrom(msg.sender, address(this), mintAmount);
        token.approve(address(cToken), mintAmount);
        uint256 cTotalBefore = cToken.totalSupply();
        require(cToken.mint(mintAmount) == 0, "mint failed");
        uint256 cTotalAfter = cToken.totalSupply();
        uint256 cMintedAmount;
        if (cTotalAfter > cTotalBefore) {
            cMintedAmount = cTotalAfter - cTotalBefore;
        } // else can there be case that we mint but we get less cTokens!?

        // update Account r balances
        account.rAmount = account.rAmount.add(mintAmount);
        totalSupply = totalSupply.add(mintAmount);

        // update Account c balances
        distribute(msg.sender, mintAmount, cMintedAmount);

        emit Mint(msg.sender, mintAmount);
    }

    /**
     * @notice Sender redeems rTokens in exchange for the underlying asset
     * @dev Withdraw equal amount of initially supplied underlying assets
     * @param redeemTokens The number of rTokens to redeem into underlying
     */
    function redeemInternal(uint256 redeemTokens) internal {
        IERC20 token = IERC20(cToken.underlying());

        Account storage account = accounts[msg.sender];
        require(redeemTokens > 0, "Redeem amount cannot be zero");
        require(redeemTokens <= account.rAmount, "Not enough balance to redeem");

        /*uint256 cAmountCollected = */redeemAndRecollect(msg.sender, redeemTokens);

        // update Account r balances and global statistics
        account.rAmount = account.rAmount.sub(redeemTokens);
        totalSupply = totalSupply.sub(redeemTokens);

        // transfer the token back
        token.transfer(msg.sender, redeemTokens);

        emit Redeem(msg.sender, redeemTokens);
    }

    /**
     * @dev Create a new Hat
     * @param recipients List of beneficial recipients
     * @param proportions Relative proportions of benefits received by the recipients
     */
    function createHatInternal(
        address[] memory recipients,
        uint32[] memory proportions) internal returns (uint256 hatID) {
        uint i;

        require(recipients.length > 0, "Invalid hat: at least one recipient");
        require(recipients.length == proportions.length, "Invalid hat: length not matching");

        // normalize the proportions
        uint256 totalProportions = 0;
        for (i = 0; i < recipients.length; ++i) {
            require(proportions[i] > 0, "Invalid hat: proportion should be larger than 0");
            totalProportions += uint256(proportions[i]);
        }
        for (i = 0; i < proportions.length; ++i) {
            proportions[i] = uint32(
                uint256(proportions[i])
                * uint256(PROPORTION_BASE)
                / totalProportions);
        }

        hatID = hats.push(Hat(
            recipients,
            proportions
        )) - 1;
        emit HatCreated(hatID);
    }

    /**
     * @dev Change the hat for `owner`
     * @param owner Account owner
     * @param hatID The id of the Hat
     */
    function changeHatInternal(address owner, uint256 hatID) internal {
        Account storage account = accounts[owner];
        if (account.rAmount > 0) {
            require(false, "wtf!");
            uint256 cAmountCollected = estimateAndRecollect(owner, account.rAmount);
            account.hatID = hatID;
            distribute(owner, account.rAmount, cAmountCollected);
        } else {
            account.hatID = hatID;
        }
        emit HatChanged(owner, hatID);
    }

    /**
     * @dev Distribute the incoming rTokens to the recipients for future interests.
     *      It alters the rDebt and cAmount of recipient accounts.
     *      Recipient also inherits the owner's hat if it does already have one.
     */
    function distribute(
            address owner,
            uint256 rAmount,
            uint256 cAmount) internal {
        Account storage account = accounts[owner];
        Hat storage hat = hats[account.hatID];
        bool[] memory recipientsNeedsNewHat = new bool[](hat.recipients.length);
        uint i;
        if (hat.recipients.length > 0) {
            uint256 rLeft = rAmount;
            uint256 cLeft = cAmount;
            for (i = 0; i < hat.proportions.length; ++i) {
                Account storage recipient = accounts[hat.recipients[i]];
                bool isLastRecipient = i == (hat.proportions.length - 1);

                // inherit the hat if needed
                if (recipient.hatID == 0) {
                    recipientsNeedsNewHat[i] = true;
                }

                uint256 rDebtRecipient = isLastRecipient ? rLeft :
                    rAmount
                    * hat.proportions[i]
                    / PROPORTION_BASE;
                account.rRecipients[hat.recipients[i]] = account.rRecipients[hat.recipients[i]].add(rDebtRecipient);
                recipient.rDebt = recipient.rDebt.add(rDebtRecipient);
                // leftover adjustments
                if (rLeft > rDebtRecipient) {
                    rLeft -= rDebtRecipient;
                } else {
                    rLeft = 0;
                }

                uint256 cAmountRecipient = isLastRecipient ? cLeft:
                    cAmount
                    * hat.proportions[i]
                    / PROPORTION_BASE;
                recipient.cAmount = recipient.cAmount.add(cAmountRecipient);
                // leftover adjustments
                if (cLeft >= cAmountRecipient) {
                    cLeft -= cAmountRecipient;
                } else {
                    rLeft = 0;
                }
            }
        } else {
            // Account uses the zero hat, give all interest to the owner
            account.rDebt = rAmount;
            account.cAmount = account.cAmount.add(cAmount);
        }

        // apply to new hat owners
        for (i = 0; i < hat.proportions.length; ++i) {
            if (recipientsNeedsNewHat[i]) {
                changeHatInternal(hat.recipients[i], account.hatID);
            }
        }
    }

    /**
     * @dev Recollect rTokens from the recipients for further distribution
     *      without actually redeeming the cToken
     */
    function estimateAndRecollect(
        address owner,
        uint256 rAmount) internal returns (uint256 cEstimatedAmount) {
        Account storage account = accounts[owner];
        Hat storage hat = hats[account.hatID];
        // accrue interest so estimate is up to date
        cToken.accrueInterest();
        cEstimatedAmount = rAmount
            .mul(10 ** 18)
            .div(cToken.exchangeRateStored());
        recollect(account, hat, rAmount, cEstimatedAmount);
    }

    /**
     * @dev Recollect rTokens from the recipients for further distribution
     *      by redeeming the underlying tokens in `rAmount`
     */
    function redeemAndRecollect(
        address owner,
        uint256 rAmount) internal returns (uint256 cBurnedAmount) {
        Account storage account = accounts[owner];
        Hat storage hat = hats[account.hatID];
        uint256 cTotalBefore = cToken.totalSupply();
        require(cToken.redeemUnderlying(rAmount) == 0, "redeemUnderlying failed");
        uint256 cTotalAfter = cToken.totalSupply();
        if (cTotalAfter < cTotalBefore) {
            cBurnedAmount = cTotalBefore - cTotalAfter;
        } // else can there be case that we end up with more cTokens ?!
        recollect(account, hat, rAmount, cBurnedAmount);
    }

    /**
     * @dev Recollect rTokens from the recipients for further distribution
     *      with cAmount provided
     *
     * It alters the rDebt and cAmount of recipient accounts
     */
    function recollect(
        Account storage account,
        Hat storage hat,
        uint256 rAmount,
        uint256 cAmount) internal {
        uint i;
        if (hat.recipients.length > 0) {
            uint256 rLeft = rAmount;
            uint256 cLeft = cAmount;
            for (i = 0; i < hat.proportions.length; ++i) {
                Account storage recipient = accounts[hat.recipients[i]];
                bool isLastRecipient = i == (hat.proportions.length - 1);

                uint256 rDebtRecipient = isLastRecipient ? rLeft: rAmount
                    * hat.proportions[i]
                    / PROPORTION_BASE;
                if (recipient.rDebt > rDebtRecipient) {
                    recipient.rDebt -= rDebtRecipient;
                } else {
                    recipient.rDebt = 0;
                }
                if (account.rRecipients[hat.recipients[i]] > rDebtRecipient) {
                    account.rRecipients[hat.recipients[i]] -= rDebtRecipient;
                } else {
                    account.rRecipients[hat.recipients[i]] = 0;
                }
                // leftover adjustments
                if (rLeft > rDebtRecipient) {
                    rLeft -= rDebtRecipient;
                } else {
                    rLeft = 0;
                }

                uint256 cAmountRecipient = isLastRecipient ? cLeft:
                    cAmount
                    * hat.proportions[i]
                    / PROPORTION_BASE;
                if (recipient.cAmount > cAmountRecipient) {
                    recipient.cAmount -= cAmountRecipient;
                } else {
                    recipient.cAmount = 0;
                }
                // leftover adjustments
                if (cLeft >= cAmountRecipient) {
                    cLeft -= cAmountRecipient;
                } else {
                    rLeft = 0;
                }
            }
        } else {
            // Account uses the zero hat, recollect interests from the owner
            account.rDebt = account.rDebt.sub(rAmount);
            if (account.cAmount >= cAmount) {
                account.cAmount = account.cAmount - cAmount;
            } else {
                account.cAmount = 0;
            }
        }
    }
}
