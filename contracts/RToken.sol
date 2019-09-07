pragma solidity ^0.5.8;
pragma experimental ABIEncoderV2;

import {SafeMath} from "openzeppelin-solidity/contracts/math/SafeMath.sol";
import {Ownable} from "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import {ReentrancyGuard} from "openzeppelin-solidity/contracts/utils/ReentrancyGuard.sol";
import {IERC20, IRToken} from "./IRToken.sol";
import {IAllocationStrategy} from "./IAllocationStrategy.sol";

/**
 * @notice RToken an ERC20 token that is 1:1 redeemable to its underlying ERC20 token.
 */
contract RToken is IRToken, Ownable, ReentrancyGuard {

    using SafeMath for uint256;

    uint256 public constant SELF_HAT_ID = uint256(int256(-1));

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
    constructor(IAllocationStrategy allocationStrategy) public {
        ias = allocationStrategy;
        token = IERC20(ias.underlying());
        // special hat aka. zero hat : hatID = 0
        hats.push(Hat(new address[](0), new uint32[](0)));
    }

    //
    // ERC20 Interface
    //

    /**
     * @notice EIP-20 token name for this token
     */
    string public name = "Redeemable DAI (rDAI ethberlin)";

    /**
     * @notice EIP-20 token symbol for this token
     */
    string public symbol = "rDAItest";

    /**
     * @notice EIP-20 token decimals for this token
     */
    uint256 public decimals = 18;

     /**
      * @notice Total number of tokens in circulation
      */
    uint256 public totalSupply;

    /**
     * @notice Returns the amount of tokens owned by `account`.
     */
    function balanceOf(address owner) external view returns (uint256) {
        return accounts[owner].rAmount;
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
     * @notice Moves `amount` tokens from the caller's account to `dst`.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * Emits a `Transfer` event.
     * May also emit `InterestPaid` event.
     */
    function transfer(address dst, uint256 amount) external nonReentrant returns (bool) {
        return transferInternal(msg.sender, msg.sender, dst, amount);
    }

    /// @dev IRToken.transferAll implementation
    function transferAll(address dst) external nonReentrant returns (bool) {
        address src = msg.sender;
        payInterestInternal(src);
        return transferInternal(src, src, dst, accounts[src].rAmount);
    }

    /// @dev IRToken.transferAllFrom implementation
    function transferAllFrom(address src, address dst) external nonReentrant returns (bool) {
        payInterestInternal(src);
        payInterestInternal(dst);
        return transferInternal(msg.sender, src, dst, accounts[src].rAmount);
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

    /// @dev IRToken.mint implementation
    function mint(uint256 mintAmount) external nonReentrant returns (bool) {
        mintInternal(mintAmount);
        return true;
    }

    /// @dev IRToken.mintWithSelectedHat implementation
    function mintWithSelectedHat(uint256 mintAmount, uint256 hatID) external nonReentrant returns (bool) {
        require(hatID == SELF_HAT_ID || hatID < hats.length, "Invalid hat ID");
        changeHatInternal(msg.sender, hatID);
        mintInternal(mintAmount);
        return true;
    }

    /**
     * @dev IRToken.mintWithNewHat implementation
     */
    function mintWithNewHat(uint256 mintAmount,
        address[] calldata recipients,
        uint32[] calldata proportions) external nonReentrant returns (bool) {
        uint256 hatID = createHatInternal(recipients, proportions);
        changeHatInternal(msg.sender, hatID);

        mintInternal(mintAmount);

        return true;
    }

    /**
     * @dev IRToken.redeem implementation
     *      It withdraws equal amount of initially supplied underlying assets
     */
    function redeem(uint256 redeemTokens) external nonReentrant returns (bool) {
        address src = msg.sender;
        payInterestInternal(src);
        redeemInternal(src, redeemTokens);
        return true;
    }

    /// @dev IRToken.redeemAll implementation
    function redeemAll() external nonReentrant returns (bool) {
        address src = msg.sender;
        payInterestInternal(src);
        redeemInternal(src, accounts[src].rAmount);
        return true;
    }

    /// @dev IRToken.redeemAndTransfer implementation
    function redeemAndTransfer(address redeemTo, uint256 redeemTokens) external nonReentrant returns (bool) {
        address src = msg.sender;
        payInterestInternal(src);
        redeemInternal(redeemTo, redeemTokens);
        return true;
    }

    /// @dev IRToken.redeemAndTransferAll implementation
    function redeemAndTransferAll(address redeemTo) external nonReentrant returns (bool) {
        address src = msg.sender;
        payInterestInternal(src);
        redeemInternal(redeemTo, accounts[src].rAmount);
        return true;
    }

     /// @dev IRToken.createHat implementation
    function createHat(
        address[] calldata recipients,
        uint32[] calldata proportions,
        bool doChangeHat) external nonReentrant returns (uint256 hatID) {
        hatID = createHatInternal(recipients, proportions);
        if (doChangeHat) {
            changeHatInternal(msg.sender, hatID);
        }
    }

    /// @dev IRToken.changeHat implementation
    function changeHat(uint256 hatID) external nonReentrant {
        changeHatInternal(msg.sender, hatID);
    }

    /// @dev IRToken.getMaximumHatID implementation
    function getMaximumHatID() external view returns (uint256 hatID) {
        return hats.length - 1;
    }

    /// @dev IRToken.getHatByAddress implementation
    function getHatByAddress(address owner) external view returns (
        uint256 hatID,
        address[] memory recipients,
        uint32[] memory proportions) {
        hatID = accounts[owner].hatID;
        if (hatID != 0 && hatID != SELF_HAT_ID) {
            Hat memory hat = hats[hatID];
            recipients = hat.recipients;
            proportions = hat.proportions;
        } else {
            recipients = new address[](0);
            proportions = new uint32[](0);
        }
    }

    /// @dev IRToken.getHatByID implementation
    function getHatByID(uint256 hatID) external view returns (
        address[] memory recipients,
        uint32[] memory proportions) {
        if (hatID != 0 && hatID != SELF_HAT_ID) {
            Hat memory hat = hats[hatID];
            recipients = hat.recipients;
            proportions = hat.proportions;
        } else {
            recipients = new address[](0);
            proportions = new uint32[](0);
        }
    }

    /// @dev IRToken.receivedSavingsOf implementation
    function receivedSavingsOf(address owner) external view returns (uint256 amount) {
        Account storage account = accounts[owner];
        uint256 rGross =
            account.sInternalAmount
            .mul(ias.exchangeRateStored())
            .div(savingAssetConversionRate); // the 1e18 decimals should be cancelled out
        return rGross;
    }

    /// @dev IRToken.receivedLoanOf implementation
    function receivedLoanOf(address owner) external view returns (uint256 amount) {
        Account storage account = accounts[owner];
        return account.lDebt;
    }

    /// @dev IRToken.interestPayableOf implementation
    function interestPayableOf(address owner) external view returns (uint256 amount) {
        Account storage account = accounts[owner];
        return getInterestPayableOf(account);
    }

    /// @dev IRToken.payInterest implementation
    function payInterest(address owner) external nonReentrant returns (bool) {
        payInterestInternal(owner);
        return true;
    }

    /// @dev IRToken.getAccountStats implementation!1
    function getGlobalStats() external view returns (GlobalStats memory) {
        uint256 totalSavingsAmount;
        totalSavingsAmount +=
            savingAssetOrignalAmount
            .mul(ias.exchangeRateStored())
            .div(10 ** 18);
        return GlobalStats({
            totalSupply: totalSupply,
            totalSavingsAmount: totalSavingsAmount
        });
    }

    /// @dev IRToken.getAccountStats implementation
    function getAccountStats(address owner) external view returns (AccountStats memory) {
        Account storage account = accounts[owner];
        return account.stats;
    }

    /// @dev IRToken.getCurrentSavingStrategy implementation
    function getCurrentSavingStrategy() external view returns (address) {
        return address(ias);
    }

    /// @dev IRToken.getSavingAssetBalance implementation
    function getSavingAssetBalance() external view
        returns (uint256 nAmount, uint256 sAmount) {
        sAmount = savingAssetOrignalAmount;
        nAmount = sAmount
            .mul(ias.exchangeRateStored())
            .div(10 ** 18);
    }

    /// @dev IRToken.changeAllocationStrategy implementation
    function changeAllocationStrategy(IAllocationStrategy allocationStrategy) external nonReentrant onlyOwner {
        require(allocationStrategy.underlying() == address(token), "New strategy should have the same underlying asset");
        IAllocationStrategy oldIas = ias;
        ias = allocationStrategy;
        // redeem everything from the old strategy
        uint256 sOriginalBurned = oldIas.redeemUnderlying(totalSupply);
        // invest everything into the new strategy
        token.transferFrom(msg.sender, address(this), totalSupply);
        token.approve(address(ias), totalSupply);
        uint256 sOriginalCreated = ias.investUnderlying(totalSupply);
        // calculate new saving asset conversion rate
        // if new original saving asset is 2x in amount
        // then the conversion of internal amount should be also 2x
        savingAssetConversionRate =
            sOriginalCreated
            .mul(10 ** 18)
            .div(sOriginalBurned);
    }

    //
    // internal
    //

    /// @dev Current saving strategy
    IAllocationStrategy private ias;

    /// @dev Underlying token
    IERC20 private token;

    /// @dev Saving assets original amount
    uint256 private savingAssetOrignalAmount;

    /// @dev Saving asset original to internal amount conversion rate.
    ///      - It has 18 decimals
    ///      - It starts with value 1.
    ///      - Each strategy switching results a new conversion rate
    uint256 private savingAssetConversionRate = 10 ** 18;

    /// @dev Saving assets exchange rate with

    /// @dev Approved token transfer amounts on behalf of others
    mapping(address => mapping(address => uint256)) private transferAllowances;

    /// @dev Hat list
    Hat[] private hats;

    /// @dev Account structure
    struct Account {
        //
        // Essential info
        //
        /// @dev ID of the hat selected for the account
        uint256 hatID;
        /// @dev Redeemable token balance for the account
        uint256 rAmount;
        /// @dev Redeemable token balance portion that is from interest payment
        uint256 rInterest;
        /// @dev Mapping of recipients and their amount of debt
        mapping (address => uint256) lRecipients;
        /// @dev Loan debt amount for the account
        uint256 lDebt;
        /// @dev Saving asset amount internal
        uint256 sInternalAmount;

        /// @dev Stats
        AccountStats stats;
    }

    /// @dev Account mapping
    mapping (address => Account) private accounts;

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

        // pay the interest before doing the transfer
        payInterestInternal(src);

        require(accounts[src].rAmount >= tokens, "Not enough balance to transfer");

        /* Get the allowance, infinite for the account owner */
        uint256 startingAllowance = 0;
        if (spender == src) {
            startingAllowance = uint256(-1);
        } else {
            startingAllowance = transferAllowances[src][spender];
        }
        require(startingAllowance >= tokens, "Not enough allowance for transfer");

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

        // lRecipients adjustments
        uint256 sInternalAmountCollected = estimateAndRecollectLoans(src, tokens);
        distributeLoans(dst, tokens, sInternalAmountCollected);

        // rInterest adjustment for src
        if (accounts[src].rInterest > accounts[src].rAmount) {
            accounts[src].rInterest = accounts[src].rAmount;
        }

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
        require(token.allowance(msg.sender, address(this)) >= mintAmount, "Not enough allowance");

        Account storage account = accounts[msg.sender];

        // create saving assets
        token.transferFrom(msg.sender, address(this), mintAmount);
        token.approve(address(ias), mintAmount);
        uint256 sOriginalCreated = ias.investUnderlying(mintAmount);

        // update global and account r balances
        totalSupply = totalSupply.add(mintAmount);
        account.rAmount = account.rAmount.add(mintAmount);

        // update global stats
        savingAssetOrignalAmount += sOriginalCreated;

        // distribute saving assets as loans to recipients
        uint256 sInternalCreated =
            sOriginalCreated
            .mul(savingAssetConversionRate)
            .div(10 ** 18);
        distributeLoans(msg.sender, mintAmount, sInternalCreated);

        emit Mint(msg.sender, mintAmount);
        emit Transfer(address(this), msg.sender, mintAmount);
    }

    /**
     * @notice Sender redeems rTokens in exchange for the underlying asset
     * @dev Withdraw equal amount of initially supplied underlying assets
     * @param redeemTo Destination address to send the redeemed tokens to
     * @param redeemAmount The number of rTokens to redeem into underlying
     */
    function redeemInternal(address redeemTo, uint256 redeemAmount) internal {
        Account storage account = accounts[msg.sender];
        require(redeemAmount > 0, "Redeem amount cannot be zero");
        require(redeemAmount <= account.rAmount, "Not enough balance to redeem");

        uint256 sOriginalBurned = redeemAndRecollectLoans(msg.sender, redeemAmount);

        // update Account r balances and global statistics
        account.rAmount = account.rAmount.sub(redeemAmount);
        if (account.rInterest > account.rAmount) {
            account.rInterest = account.rAmount;
        }
        totalSupply = totalSupply.sub(redeemAmount);

        // update global stats
        if (savingAssetOrignalAmount > sOriginalBurned) {
            savingAssetOrignalAmount -= sOriginalBurned;
        } else {
            savingAssetOrignalAmount = 0;
        }

        // transfer the token back
        token.transfer(redeemTo, redeemAmount);

        emit Transfer(msg.sender, address(this), redeemAmount);
        emit Redeem(msg.sender, redeemTo, redeemAmount);
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
            uint256 sInternalAmountCollected = estimateAndRecollectLoans(owner, account.rAmount);
            account.hatID = hatID;
            distributeLoans(owner, account.rAmount, sInternalAmountCollected);
        } else {
            account.hatID = hatID;
        }
        emit HatChanged(owner, hatID);
    }

    /**
     * @dev Get interest payable of the account
     */
    function getInterestPayableOf(Account storage account) internal view returns (uint256) {
        uint256 rGross =
            account.sInternalAmount
            .mul(ias.exchangeRateStored())
            .div(savingAssetConversionRate); // the 1e18 decimals should be cancelled out
        if (rGross > (account.lDebt + account.rInterest)) {
            return rGross - account.lDebt - account.rInterest;
        } else {
            // no interest accumulated yet or even negative interest rate!?
            return 0;
        }
    }

    /**
     * @dev Distribute the incoming tokens to the recipients as loans.
     *      The tokens are immediately invested into the saving strategy and
     *      add to the sAmount of the recipient account.
     *      Recipient also inherits the owner's hat if it does already have one.
     * @param owner Owner account address
     * @param rAmount rToken amount being loaned to the recipients
     * @param sInternalAmount Amount of saving assets (internal amount) being given to the recipients
     */
    function distributeLoans(
            address owner,
            uint256 rAmount,
            uint256 sInternalAmount) internal {
        Account storage account = accounts[owner];
        Hat storage hat = hats[account.hatID == SELF_HAT_ID ? 0 : account.hatID];
        bool[] memory recipientsNeedsNewHat = new bool[](hat.recipients.length);
        uint i;
        if (hat.recipients.length > 0) {
            uint256 rLeft = rAmount;
            uint256 sInternalLeft = sInternalAmount;
            for (i = 0; i < hat.proportions.length; ++i) {
                Account storage recipient = accounts[hat.recipients[i]];
                bool isLastRecipient = i == (hat.proportions.length - 1);

                // inherit the hat if needed
                if (recipient.hatID == 0) {
                    recipientsNeedsNewHat[i] = true;
                }

                uint256 lDebtRecipient = isLastRecipient ? rLeft :
                    rAmount
                    * hat.proportions[i]
                    / PROPORTION_BASE;
                account.lRecipients[hat.recipients[i]] = account.lRecipients[hat.recipients[i]].add(lDebtRecipient);
                recipient.lDebt = recipient.lDebt.add(lDebtRecipient);
                // leftover adjustments
                if (rLeft > lDebtRecipient) {
                    rLeft -= lDebtRecipient;
                } else {
                    rLeft = 0;
                }

                uint256 sInternalAmountRecipient = isLastRecipient ? sInternalLeft:
                    sInternalAmount
                    * hat.proportions[i]
                    / PROPORTION_BASE;
                recipient.sInternalAmount = recipient.sInternalAmount.add(sInternalAmountRecipient);
                // leftover adjustments
                if (sInternalLeft >= sInternalAmountRecipient) {
                    sInternalLeft -= sInternalAmountRecipient;
                } else {
                    sInternalLeft = 0;
                }
            }
        } else {
            // Account uses the zero hat, give all interest to the owner
            account.lDebt = account.lDebt.add(rAmount);
            account.sInternalAmount = account.sInternalAmount.add(sInternalAmount);
        }

        // apply to new hat owners
        for (i = 0; i < hat.proportions.length; ++i) {
            if (recipientsNeedsNewHat[i]) {
                changeHatInternal(hat.recipients[i], account.hatID);
            }
        }
    }

    /**
     * @dev Recollect loans from the recipients for further distribution
     *      without actually redeeming the saving assets
     * @param owner Owner account address
     * @param rAmount rToken amount neeeds to be recollected from the recipients
     *                by giving back estimated amount of saving assets
     * @return Estimated amount of saving assets (internal) needs to recollected
     */
    function estimateAndRecollectLoans(
        address owner,
        uint256 rAmount) internal returns (uint256 sInternalAmount) {
        Account storage account = accounts[owner];
        Hat storage hat = hats[account.hatID == SELF_HAT_ID ? 0 : account.hatID];
        // accrue interest so estimate is up to date
        ias.accrueInterest();
        sInternalAmount = rAmount
            .mul(savingAssetConversionRate)
            .div(ias.exchangeRateStored()); // the 1e18 decimals should be cancelled out
        recollectLoans(account, hat, rAmount, sInternalAmount);
    }

    /**
     * @dev Recollect loans from the recipients for further distribution
     *      by redeeming the saving assets in `rAmount`
     * @param owner Owner account address
     * @param rAmount rToken amount neeeds to be recollected from the recipients
     *                by redeeming equivalent value of the saving assets
     * @return Amount of saving assets redeemed for rAmount of tokens.
     */
    function redeemAndRecollectLoans(
        address owner,
        uint256 rAmount) internal returns (uint256 sOriginalBurned) {
        Account storage account = accounts[owner];
        Hat storage hat = hats[account.hatID == SELF_HAT_ID ? 0 : account.hatID];
        sOriginalBurned = ias.redeemUnderlying(rAmount);
        uint256 sInternalBurned =
            sOriginalBurned
            .mul(savingAssetConversionRate)
            .div(10 ** 18);
        recollectLoans(account, hat, rAmount, sInternalBurned);
    }

    /**
     * @dev Recollect loan from the recipients
     * @param account Owner account
     * @param hat     Owner's hat
     * @param rAmount rToken amount being written of from the recipients
     * @param sInternalAmount Amount of sasving assets (internal amount) recollected from the recipients
     */
    function recollectLoans(
        Account storage account,
        Hat storage hat,
        uint256 rAmount,
        uint256 sInternalAmount) internal {
        uint i;
        if (hat.recipients.length > 0) {
            uint256 rLeft = rAmount;
            uint256 sInternalLeft = sInternalAmount;
            for (i = 0; i < hat.proportions.length; ++i) {
                Account storage recipient = accounts[hat.recipients[i]];
                bool isLastRecipient = i == (hat.proportions.length - 1);

                uint256 lDebtRecipient = isLastRecipient ? rLeft: rAmount
                    * hat.proportions[i]
                    / PROPORTION_BASE;
                if (recipient.lDebt > lDebtRecipient) {
                    recipient.lDebt -= lDebtRecipient;
                } else {
                    recipient.lDebt = 0;
                }
                if (account.lRecipients[hat.recipients[i]] > lDebtRecipient) {
                    account.lRecipients[hat.recipients[i]] -= lDebtRecipient;
                } else {
                    account.lRecipients[hat.recipients[i]] = 0;
                }
                // leftover adjustments
                if (rLeft > lDebtRecipient) {
                    rLeft -= lDebtRecipient;
                } else {
                    rLeft = 0;
                }

                uint256 sInternalAmountRecipient = isLastRecipient ? sInternalLeft:
                    sInternalAmount
                    * hat.proportions[i]
                    / PROPORTION_BASE;
                if (recipient.sInternalAmount > sInternalAmountRecipient) {
                    recipient.sInternalAmount -= sInternalAmountRecipient;
                } else {
                    recipient.sInternalAmount = 0;
                }
                // leftover adjustments
                if (sInternalLeft >= sInternalAmountRecipient) {
                    sInternalLeft -= sInternalAmountRecipient;
                } else {
                    sInternalLeft = 0;
                }
            }
        } else {
            // Account uses the zero hat, recollect interests from the owner
            if (account.lDebt > rAmount) {
                account.lDebt -= rAmount;
            } else {
                account.lDebt = 0;
            }
            if (account.sInternalAmount > sInternalAmount) {
                account.sInternalAmount -= sInternalAmount;
            } else {
                account.sInternalAmount = 0;
            }
        }
    }

    /**
     * @dev pay interest to the owner
     * @param owner Account owner address
     */
    function payInterestInternal(address owner) internal {
        Account storage account = accounts[owner];

        ias.accrueInterest();
        uint256 interestAmount = getInterestPayableOf(account);

        if (interestAmount > 0) {
            account.stats.cumulativeInterest = account.stats.cumulativeInterest.add(interestAmount);
            account.rInterest = account.rInterest.add(interestAmount);
            account.rAmount = account.rAmount.add(interestAmount);
            totalSupply = totalSupply.add(interestAmount);
            emit InterestPaid(owner, interestAmount);
            emit Transfer(address(this), owner, interestAmount);
        }
    }
}
