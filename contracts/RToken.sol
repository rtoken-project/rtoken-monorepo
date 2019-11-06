/**
 * Because the use of ABIEncoderV2 , the pragma should be locked above 0.5.10 ,
 * as there is a known bug in array storage:
 * https://blog.ethereum.org/2019/06/25/solidity-storage-array-bugs/
 */
pragma solidity >=0.5.10 <0.6.0;
pragma experimental ABIEncoderV2;

import {Proxiable} from "./Proxiable.sol";
import {Ownable} from "./Ownable.sol";
import {LibraryLock} from "./LibraryLock.sol";
import {SafeMath} from "openzeppelin-solidity/contracts/math/SafeMath.sol";
import {ReentrancyGuard} from "./ReentrancyGuard.sol";
import {RTokenStructs} from "./RTokenStructs.sol";
import {RTokenStorage} from "./RTokenStorage.sol";
import {IERC20, IRToken} from "./IRToken.sol";
import {IRTokenAdmin} from "./IRTokenAdmin.sol";
import {IAllocationStrategy} from "./IAllocationStrategy.sol";

/**
 * @notice RToken an ERC20 token that is 1:1 redeemable to its underlying ERC20 token.
 */
contract RToken is
    RTokenStorage,
    IRToken,
    IRTokenAdmin,
    Ownable,
    Proxiable,
    LibraryLock,
    ReentrancyGuard {
    using SafeMath for uint256;


    uint256 public constant ALLOCATION_STRATEGY_EXCHANGE_RATE_SCALE = 1e18;
    uint256 public constant INITIAL_SAVING_ASSET_CONVERSION_RATE = 1e18;
    uint256 public constant MAX_UINT256 = uint256(int256(-1));
    uint256 public constant SELF_HAT_ID = MAX_UINT256;
    uint32 public constant PROPORTION_BASE = 0xFFFFFFFF;
    uint256 public constant MAX_NUM_HAT_RECIPIENTS = 50;

    /**
     * @notice Create rToken linked with cToken at `cToken_`
     */
    function initialize(
        IAllocationStrategy allocationStrategy,
        string calldata name_,
        string calldata symbol_,
        uint256 decimals_) external {
        require(!initialized, "The library has already been initialized.");
        LibraryLock.initialize();
        _owner = msg.sender;
        _guardCounter = 1;
        name = name_;
        symbol = symbol_;
        decimals = decimals_;
        savingAssetConversionRate = INITIAL_SAVING_ASSET_CONVERSION_RATE;
        ias = allocationStrategy;
        token = IERC20(ias.underlying());

        // special hat aka. zero hat : hatID = 0
        hats.push(Hat(new address[](0), new uint32[](0)));

        // everyone is using it by default!
        hatStats[0].useCount = MAX_UINT256;

        emit AllocationStrategyChanged(address(ias), savingAssetConversionRate);
    }

    //
    // ERC20 Interface
    //

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
    function allowance(address owner, address spender)
        external
        view
        returns (uint256)
    {
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
    function transfer(address dst, uint256 amount)
        external
        nonReentrant
        returns (bool)
    {
        address src = msg.sender;
        payInterestInternal(src);
        transferInternal(src, src, dst, amount);
        payInterestInternal(dst);
        return true;
    }

    /// @dev IRToken.transferAll implementation
    function transferAll(address dst) external nonReentrant returns (bool) {
        address src = msg.sender;
        payInterestInternal(src);
        transferInternal(src, src, dst, accounts[src].rAmount);
        payInterestInternal(dst);
        return true;
    }

    /// @dev IRToken.transferAllFrom implementation
    function transferAllFrom(address src, address dst)
        external
        nonReentrant
        returns (bool)
    {
        payInterestInternal(src);
        transferInternal(msg.sender, src, dst, accounts[src].rAmount);
        payInterestInternal(dst);
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
    function transferFrom(address src, address dst, uint256 amount)
        external
        nonReentrant
        returns (bool)
    {
        payInterestInternal(src);
        transferInternal(msg.sender, src, dst, amount);
        payInterestInternal(dst);
        return true;
    }

    //
    // rToken interface
    //

    /// @dev IRToken.mint implementation
    function mint(uint256 mintAmount) external nonReentrant returns (bool) {
        mintInternal(mintAmount);
        payInterestInternal(msg.sender);
        return true;
    }

    /// @dev IRToken.mintWithSelectedHat implementation
    function mintWithSelectedHat(uint256 mintAmount, uint256 hatID)
        external
        nonReentrant
        returns (bool)
    {
        changeHatInternal(msg.sender, hatID);
        mintInternal(mintAmount);
        payInterestInternal(msg.sender);
        return true;
    }

    /**
     * @dev IRToken.mintWithNewHat implementation
     */
    function mintWithNewHat(
        uint256 mintAmount,
        address[] calldata recipients,
        uint32[] calldata proportions
    ) external nonReentrant returns (bool) {
        uint256 hatID = createHatInternal(recipients, proportions);
        changeHatInternal(msg.sender, hatID);
        mintInternal(mintAmount);
        payInterestInternal(msg.sender);
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
    function redeemAndTransfer(address redeemTo, uint256 redeemTokens)
        external
        nonReentrant
        returns (bool)
    {
        address src = msg.sender;
        payInterestInternal(src);
        redeemInternal(redeemTo, redeemTokens);
        return true;
    }

    /// @dev IRToken.redeemAndTransferAll implementation
    function redeemAndTransferAll(address redeemTo)
        external
        nonReentrant
        returns (bool)
    {
        address src = msg.sender;
        payInterestInternal(src);
        redeemInternal(redeemTo, accounts[src].rAmount);
        return true;
    }

    /// @dev IRToken.createHat implementation
    function createHat(
        address[] calldata recipients,
        uint32[] calldata proportions,
        bool doChangeHat
    ) external nonReentrant returns (uint256 hatID) {
        hatID = createHatInternal(recipients, proportions);
        if (doChangeHat) {
            changeHatInternal(msg.sender, hatID);
        }
    }

    /// @dev IRToken.changeHat implementation
    function changeHat(uint256 hatID) external nonReentrant returns (bool) {
        changeHatInternal(msg.sender, hatID);
        payInterestInternal(msg.sender);
        return true;
    }

    /// @dev IRToken.getMaximumHatID implementation
    function getMaximumHatID() external view returns (uint256 hatID) {
        return hats.length - 1;
    }

    /// @dev IRToken.getHatByAddress implementation
    function getHatByAddress(address owner)
        external
        view
        returns (
            uint256 hatID,
            address[] memory recipients,
            uint32[] memory proportions
        )
    {
        hatID = accounts[owner].hatID;
        (recipients, proportions) = _getHatByID(hatID);
    }

    /// @dev IRToken.getHatByID implementation
    function getHatByID(uint256 hatID)
        external
        view
        returns (address[] memory recipients, uint32[] memory proportions) {
        (recipients, proportions) = _getHatByID(hatID);
    }

    function _getHatByID(uint256 hatID)
        private
        view
        returns (address[] memory recipients, uint32[] memory proportions) {
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
    function receivedSavingsOf(address owner)
        external
        view
        returns (uint256 amount)
    {
        Account storage account = accounts[owner];
        uint256 rGross = sInternalToR(account.sInternalAmount);
        return rGross;
    }

    /// @dev IRToken.receivedLoanOf implementation
    function receivedLoanOf(address owner)
        external
        view
        returns (uint256 amount)
    {
        Account storage account = accounts[owner];
        return account.lDebt;
    }

    /// @dev IRToken.interestPayableOf implementation
    function interestPayableOf(address owner)
        external
        view
        returns (uint256 amount)
    {
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
        totalSavingsAmount += sOriginalToR(savingAssetOrignalAmount);
        return
            GlobalStats({
                totalSupply: totalSupply,
                totalSavingsAmount: totalSavingsAmount
            });
    }

    /// @dev IRToken.getAccountStats implementation
    function getAccountStats(address owner)
        external
        view
        returns (AccountStatsView memory stats)
    {
        Account storage account = accounts[owner];
        stats.hatID = account.hatID;
        stats.rAmount = account.rAmount;
        stats.rInterest = account.rInterest;
        stats.lDebt = account.lDebt;
        stats.sInternalAmount = account.sInternalAmount;

        stats.rInterestPayable = getInterestPayableOf(account);

        AccountStatsStored storage statsStored = accountStats[owner];
        stats.cumulativeInterest = statsStored.cumulativeInterest;

        return stats;
    }

    /// @dev IRToken.getHatStats implementation
    function getHatStats(uint256 hatID)
        external
        view
        returns (HatStatsView memory stats) {
        HatStatsStored storage statsStored = hatStats[hatID];
        stats.useCount = statsStored.useCount;
        stats.totalLoans = statsStored.totalLoans;

        stats.totalSavings = sInternalToR(statsStored.totalInternalSavings);
        return stats;
    }

    /// @dev IRToken.getCurrentSavingStrategy implementation
    function getCurrentSavingStrategy() external view returns (address) {
        return address(ias);
    }

    /// @dev IRToken.getSavingAssetBalance implementation
    function getSavingAssetBalance()
        external
        view
        returns (uint256 rAmount, uint256 sOriginalAmount)
    {
        sOriginalAmount = savingAssetOrignalAmount;
        rAmount = sOriginalToR(sOriginalAmount);
    }

    /// @dev IRToken.changeAllocationStrategy implementation
    function changeAllocationStrategy(address allocationStrategy_)
        external
        nonReentrant
        onlyOwner
    {
        IAllocationStrategy allocationStrategy = IAllocationStrategy(allocationStrategy_);
        require(
            allocationStrategy.underlying() == address(token),
            "New strategy should have the same underlying asset"
        );
        IAllocationStrategy oldIas = ias;
        ias = allocationStrategy;
        // redeem everything from the old strategy
        uint256 sOriginalBurned = oldIas.redeemUnderlying(totalSupply);
        // invest everything into the new strategy
        require(token.approve(address(ias), totalSupply), "token approve failed");
        uint256 sOriginalCreated = ias.investUnderlying(totalSupply);

        // calculate new saving asset conversion rate
        //
        // NOTE:
        //   - savingAssetConversionRate should be scaled by 1e18
        //   - to keep internalSavings constant:
        //     internalSavings == sOriginalBurned * savingAssetConversionRateOld
        //     internalSavings == sOriginalCreated * savingAssetConversionRateNew
        //     =>
        //     savingAssetConversionRateNew = sOriginalBurned
        //          * savingAssetConversionRateOld
        //          / sOriginalCreated
        //
        uint256 savingAssetConversionRateOld = savingAssetConversionRate;
        savingAssetConversionRate = sOriginalBurned
            .mul(savingAssetConversionRateOld)
            .div(sOriginalCreated);

        emit AllocationStrategyChanged(allocationStrategy_, savingAssetConversionRate);
    }

    /// @dev IRToken.changeHatFor implementation
    function getCurrentAllocationStrategy()
        external view returns (address allocationStrategy) {
        return address(ias);
    }

    /// @dev IRToken.changeHatFor implementation
    function changeHatFor(address contractAddress, uint256 hatID) external onlyOwner {
        require(_isContract(contractAddress), "Admin can only change hat for contract address");
        changeHatInternal(contractAddress, hatID);
    }

    /// @dev Update the rToken logic contract code
    function updateCode(address newCode) external onlyOwner delegatedOnly {
        updateCodeAddress(newCode);
        emit CodeUpdated(newCode);
    }

    /**
     * @dev Transfer `tokens` tokens from `src` to `dst` by `spender`
            Called by both `transfer` and `transferFrom` internally
     * @param spender The address of the account performing the transfer
     * @param src The address of the source account
     * @param dst The address of the destination account
     * @param tokens The number of tokens to transfer
     * @return Whether or not the transfer succeeded
     */
    function transferInternal(
        address spender,
        address src,
        address dst,
        uint256 tokens
    ) internal {
        require(src != dst, "src should not equal dst");

        require(
            accounts[src].rAmount >= tokens,
            "Not enough balance to transfer"
        );

        /* Get the allowance, infinite for the account owner */
        uint256 startingAllowance = 0;
        if (spender == src) {
            startingAllowance = MAX_UINT256;
        } else {
            startingAllowance = transferAllowances[src][spender];
        }
        require(
            startingAllowance >= tokens,
            "Not enough allowance for transfer"
        );

        /* Do the calculations, checking for {under,over}flow */
        uint256 allowanceNew = startingAllowance.sub(tokens);
        uint256 srcTokensNew = accounts[src].rAmount.sub(tokens);
        uint256 dstTokensNew = accounts[dst].rAmount.add(tokens);

        /////////////////////////
        // EFFECTS & INTERACTIONS
        // (No safe failures beyond this point)

        // check if src & dst have the same hat
        bool sameHat = accounts[src].hatID == accounts[dst].hatID;

        // apply hat inheritance rule
        if ((accounts[src].hatID != 0 &&
            accounts[dst].hatID == 0 &&
            accounts[src].hatID != SELF_HAT_ID)) {
            changeHatInternal(dst, accounts[src].hatID);
        }

        accounts[src].rAmount = srcTokensNew;
        accounts[dst].rAmount = dstTokensNew;

        /* Eat some of the allowance (if necessary) */
        if (startingAllowance != MAX_UINT256) {
            transferAllowances[src][spender] = allowanceNew;
        }

        // lRecipients adjustments
        if (!sameHat) {
            uint256 sInternalAmountCollected = estimateAndRecollectLoans(
                src,
                tokens
            );
            distributeLoans(dst, tokens, sInternalAmountCollected);
        } else {
            // apply same hat optimization
            sameHatTransfer(src, dst, accounts[src].hatID, tokens);
        }

        // rInterest adjustment for src
        //
        // rInterest should be the portion that is from interest payment, by
        // definition it should not be larger than rAmount.
        // It could happen because of rounding errors.
        if (accounts[src].rInterest > accounts[src].rAmount) {
            accounts[src].rInterest = accounts[src].rAmount;
        }

        /* We emit a Transfer event */
        emit Transfer(src, dst, tokens);
    }

    /**
     * @dev Sender supplies assets into the market and receives rTokens in exchange
     * @dev Invest into underlying assets immediately
     * @param mintAmount The amount of the underlying asset to supply
     */
    function mintInternal(uint256 mintAmount) internal {
        require(
            token.allowance(msg.sender, address(this)) >= mintAmount,
            "Not enough allowance"
        );

        Account storage account = accounts[msg.sender];

        // create saving assets
        require(token.transferFrom(msg.sender, address(this), mintAmount), "token transfer failed");
        require(token.approve(address(ias), mintAmount), "token approve failed");
        uint256 sOriginalCreated = ias.investUnderlying(mintAmount);

        // update global and account r balances
        totalSupply = totalSupply.add(mintAmount);
        account.rAmount = account.rAmount.add(mintAmount);

        // update global stats
        savingAssetOrignalAmount = savingAssetOrignalAmount.add(sOriginalCreated);

        // distribute saving assets as loans to recipients
        uint256 sInternalCreated = sOriginalToSInternal(sOriginalCreated);
        distributeLoans(msg.sender, mintAmount, sInternalCreated);

        emit Transfer(address(0), msg.sender, mintAmount);
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
        require(
            redeemAmount <= account.rAmount,
            "Not enough balance to redeem"
        );

        uint256 sOriginalBurned = redeemAndRecollectLoans(
            msg.sender,
            redeemAmount
        );

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
        require(token.transfer(redeemTo, redeemAmount), "token transfer failed");

        emit Transfer(msg.sender, address(0), redeemAmount);
    }

    /**
     * @dev Create a new Hat
     * @param recipients List of beneficial recipients
*    * @param proportions Relative proportions of benefits received by the recipients
     */
    function createHatInternal(
        address[] memory recipients,
        uint32[] memory proportions
    ) internal returns (uint256 hatID) {
        uint256 i;

        require(recipients.length > 0, "Invalid hat: at least one recipient");
        require(recipients.length <= MAX_NUM_HAT_RECIPIENTS, "Invalild hat: maximum number of recipients reached");
        require(
            recipients.length == proportions.length,
            "Invalid hat: length not matching"
        );

        // normalize the proportions
        // safemath is not used here, because:
        // proportions are uint32, there is no overflow concern
        uint256 totalProportions = 0;
        for (i = 0; i < recipients.length; ++i) {
            require(
                proportions[i] > 0,
                "Invalid hat: proportion should be larger than 0"
            );
            require(recipients[i] != address(0), "Invalid hat: recipient should not be 0x0");
            // don't panic, no safemath, look above comment
            totalProportions += uint256(proportions[i]);
        }
        for (i = 0; i < proportions.length; ++i) {
            proportions[i] = uint32(
                // don't panic, no safemath, look above comment
                (uint256(proportions[i]) * uint256(PROPORTION_BASE)) /
                    totalProportions
            );
        }

        hatID = hats.push(Hat(recipients, proportions)) - 1;
        emit HatCreated(hatID);
    }

    /**
     * @dev Change the hat for `owner`
     * @param owner Account owner
     * @param hatID The id of the Hat
     */
    function changeHatInternal(address owner, uint256 hatID) internal {
        require(hatID == SELF_HAT_ID || hatID < hats.length, "Invalid hat ID");
        Account storage account = accounts[owner];
        uint256 oldHatID = account.hatID;
        HatStatsStored storage oldHatStats = hatStats[oldHatID];
        HatStatsStored storage newHatStats = hatStats[hatID];
        account.hatID = hatID;
        if (account.rAmount > 0) {
            uint256 sInternalAmountCollected = estimateAndRecollectLoans(
                owner,
                account.rAmount
            );
            distributeLoans(owner, account.rAmount, sInternalAmountCollected);
        }
        oldHatStats.useCount -= 1;
        newHatStats.useCount += 1;
        emit HatChanged(owner, oldHatID, hatID);
    }

    /**
     * @dev Get interest payable of the account
     */
    function getInterestPayableOf(Account storage account)
        internal
        view
        returns (uint256)
    {
        uint256 rGross = sInternalToR(account.sInternalAmount);
        if (rGross > (account.lDebt.add(account.rInterest))) {
            // don't panic, the condition guarantees that safemath is not needed
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
        uint256 sInternalAmount
    ) internal {
        Account storage account = accounts[owner];
        Hat storage hat = hats[account.hatID == SELF_HAT_ID
            ? 0
            : account.hatID];
        uint256 i;
        if (hat.recipients.length > 0) {
            uint256 rLeft = rAmount;
            uint256 sInternalLeft = sInternalAmount;
            for (i = 0; i < hat.proportions.length; ++i) {
                address recipientAddress = hat.recipients[i];
                Account storage recipientAccount = accounts[recipientAddress];
                bool isLastRecipient = i == (hat.proportions.length - 1);

                // calculate the loan amount of the recipient
                uint256 lDebtRecipient = isLastRecipient
                    ? rLeft
                    : (rAmount.mul(hat.proportions[i])) / PROPORTION_BASE;
                // distribute the loan to the recipient
                account.lRecipients[recipientAddress] = account.lRecipients[recipientAddress]
                    .add(lDebtRecipient);
                recipientAccount.lDebt = recipientAccount.lDebt
                    .add(lDebtRecipient);
                // remaining value adjustments
                rLeft = gentleSub(rLeft, lDebtRecipient);

                // calculate the savings holdings of the recipient
                uint256 sInternalAmountRecipient = isLastRecipient
                    ? sInternalLeft
                    : (sInternalAmount.mul(hat.proportions[i])) / PROPORTION_BASE;
                recipientAccount.sInternalAmount = recipientAccount.sInternalAmount
                    .add(sInternalAmountRecipient);
                // remaining value adjustments
                sInternalLeft = gentleSub(sInternalLeft, sInternalAmountRecipient);

                _updateLoanStats(owner, recipientAddress, account.hatID, true, lDebtRecipient, sInternalAmountRecipient);
            }
        } else {
            // Account uses the zero/self hat, give all interest to the owner
            account.lDebt = account.lDebt.add(rAmount);
            account.sInternalAmount = account.sInternalAmount
                .add(sInternalAmount);

            _updateLoanStats(owner, owner, account.hatID, true, rAmount, sInternalAmount);
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
    function estimateAndRecollectLoans(address owner, uint256 rAmount)
        internal
        returns (uint256 sInternalAmount)
    {
        // accrue interest so estimate is up to date
        require(ias.accrueInterest(), "accrueInterest failed");
        sInternalAmount = rToSInternal(rAmount);
        recollectLoans(owner, rAmount, sInternalAmount);
    }

    /**
     * @dev Recollect loans from the recipients for further distribution
     *      by redeeming the saving assets in `rAmount`
     * @param owner Owner account address
     * @param rAmount rToken amount neeeds to be recollected from the recipients
     *                by redeeming equivalent value of the saving assets
     * @return Amount of saving assets redeemed for rAmount of tokens.
     */
    function redeemAndRecollectLoans(address owner, uint256 rAmount)
        internal
        returns (uint256 sOriginalBurned)
    {
        sOriginalBurned = ias.redeemUnderlying(rAmount);
        uint256 sInternalBurned = sOriginalToSInternal(sOriginalBurned);
        recollectLoans(owner, rAmount, sInternalBurned);
    }

    /**
     * @dev Recollect loan from the recipients
     * @param owner   Owner address
     * @param rAmount rToken amount being written of from the recipients
     * @param sInternalAmount Amount of sasving assets (internal amount) recollected from the recipients
     */
    function recollectLoans(
        address owner,
        uint256 rAmount,
        uint256 sInternalAmount
    ) internal {
        Account storage account = accounts[owner];
        Hat storage hat = hats[account.hatID == SELF_HAT_ID
            ? 0
            : account.hatID];
        if (hat.recipients.length > 0) {
            uint256 rLeft = rAmount;
            uint256 sInternalLeft = sInternalAmount;
            uint256 i;
            for (i = 0; i < hat.proportions.length; ++i) {
                address recipientAddress = hat.recipients[i];
                Account storage recipientAccount = accounts[recipientAddress];
                bool isLastRecipient = i == (hat.proportions.length - 1);

                // calulate loans to be collected from the recipient
                uint256 lDebtRecipient = isLastRecipient
                    ? rLeft
                    : (rAmount.mul(hat.proportions[i])) / PROPORTION_BASE;
                recipientAccount.lDebt = gentleSub(
                    recipientAccount.lDebt,
                    lDebtRecipient);
                account.lRecipients[recipientAddress] = gentleSub(
                    account.lRecipients[recipientAddress],
                    lDebtRecipient);
                // loans leftover adjustments
                rLeft = gentleSub(rLeft, lDebtRecipient);

                // calculate savings to be collected from the recipient
                uint256 sInternalAmountRecipient = isLastRecipient
                    ? sInternalLeft
                    : (sInternalAmount.mul(hat.proportions[i])) / PROPORTION_BASE;
                recipientAccount.sInternalAmount = gentleSub(
                    recipientAccount.sInternalAmount,
                    sInternalAmountRecipient);
                // savings leftover adjustments
                sInternalLeft = gentleSub(sInternalLeft, sInternalAmountRecipient);

                _updateLoanStats(owner, recipientAddress, account.hatID, false, lDebtRecipient, sInternalAmountRecipient);
            }
        } else {
            // Account uses the zero hat, recollect interests from the owner
            account.lDebt = gentleSub(account.lDebt, rAmount);
            account.sInternalAmount = gentleSub(account.sInternalAmount, sInternalAmount);

            _updateLoanStats(owner, owner, account.hatID, false, rAmount, sInternalAmount);
        }
    }

    /**
     * @dev Optimized recollect and distribute loan for the same hat
     * @param src Source address
     * @param dst Destination address
     * @param rAmount rToken amount being written of from the recipients
     */
    function sameHatTransfer(
        address src,
        address dst,
        uint256 hatID,
        uint256 rAmount) internal {
        // accrue interest so estimate is up to date
        require(ias.accrueInterest(), "accrueInterest failed");

        Account storage srcAccount = accounts[src];
        Account storage dstAccount = accounts[dst];

        uint256 sInternalAmount = rToSInternal(rAmount);

        srcAccount.lDebt = gentleSub(srcAccount.lDebt, rAmount);
        srcAccount.sInternalAmount = gentleSub(srcAccount.sInternalAmount, sInternalAmount);
        _updateLoanStats(src, src, hatID, false, rAmount, sInternalAmount);

        dstAccount.lDebt = dstAccount.lDebt.add(rAmount);
        dstAccount.sInternalAmount = dstAccount.sInternalAmount.add(sInternalAmount);
        _updateLoanStats(dst, dst, hatID, true, rAmount, sInternalAmount);
    }

    /**
     * @dev pay interest to the owner
     * @param owner Account owner address
     */
    function payInterestInternal(address owner) internal {
        Account storage account = accounts[owner];
        AccountStatsStored storage stats = accountStats[owner];

        require(ias.accrueInterest(), "accrueInterest failed");
        uint256 interestAmount = getInterestPayableOf(account);

        if (interestAmount > 0) {
            stats.cumulativeInterest = stats
                .cumulativeInterest
                .add(interestAmount);
            account.rInterest = account.rInterest.add(interestAmount);
            account.rAmount = account.rAmount.add(interestAmount);
            totalSupply = totalSupply.add(interestAmount);
            emit InterestPaid(owner, interestAmount);
            emit Transfer(address(0), owner, interestAmount);
        }
    }

    function _updateLoanStats(
        address owner,
        address recipient,
        uint256 hatID,
        bool isDistribution,
        uint256 redeemableAmount,
        uint256 sInternalAmount) private {
        HatStatsStored storage hatStats = hatStats[hatID];

        emit LoansTransferred(owner, recipient, hatID,
            isDistribution,
            redeemableAmount,
            sInternalAmount);

        if (isDistribution) {
            hatStats.totalLoans = hatStats.totalLoans.add(redeemableAmount);
            hatStats.totalInternalSavings = hatStats.totalInternalSavings
                .add(sInternalAmount);
        } else {
            hatStats.totalLoans = gentleSub(hatStats.totalLoans, redeemableAmount);
            hatStats.totalInternalSavings = gentleSub(
                hatStats.totalInternalSavings,
                sInternalAmount);
        }
    }

    function _isContract(address addr) private view returns (bool) {
      uint size;
      assembly { size := extcodesize(addr) }
      return size > 0;
    }

    /**
     * @dev Gently subtract b from a without revert
     *
     * Due to the use of integer arithmatic, imprecision may cause a tiny
     * amount to be off when substracting the otherwise precise proportions.
     */
    function gentleSub(uint256 a, uint256 b) private pure returns (uint256) {
        if (a < b) return 0;
        else return a - b;
    }

    /// @dev convert internal savings amount to redeemable amount
    function sInternalToR(uint256 sInternalAmount)
        private view
        returns (uint256 rAmount) {
        // - rGross is in underlying(redeemable) asset unit
        // - Both ias.exchangeRateStored and savingAssetConversionRate are scaled by 1e18
        //   they should cancel out
        // - Formula:
        //   savingsOriginalAmount = sInternalAmount / savingAssetConversionRate
        //   rGross = savingAssetOrignalAmount * ias.exchangeRateStored
        //   =>
        return sInternalAmount
            .mul(ias.exchangeRateStored())
            .div(savingAssetConversionRate);
    }

    /// @dev convert redeemable amount to internal savings amount
    function rToSInternal(uint256 rAmount)
        private view
        returns (uint256 sInternalAmount) {
        return rAmount
            .mul(savingAssetConversionRate)
            .div(ias.exchangeRateStored());
    }

    /// @dev convert original savings amount to redeemable amount
    function sOriginalToR(uint sOriginalAmount)
        private view
        returns (uint256 sInternalAmount) {
        return sOriginalAmount
            .mul(ias.exchangeRateStored())
            .div(ALLOCATION_STRATEGY_EXCHANGE_RATE_SCALE);
    }

    // @dev convert from original savings amount to internal savings amount
    function sOriginalToSInternal(uint sOriginalAmount)
        private view
        returns (uint256 sInternalAmount) {
        // savingAssetConversionRate is scaled by 1e18
        return sOriginalAmount
            .mul(savingAssetConversionRate)
            .div(ALLOCATION_STRATEGY_EXCHANGE_RATE_SCALE);
    }
}
