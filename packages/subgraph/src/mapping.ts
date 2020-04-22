import { BigDecimal, EthereumEvent } from '@graphprotocol/graph-ts';

import {
  RToken,
  AllocationStrategyChanged as AllocationStrategyChangedEvent,
  Approval as ApprovalEvent,
  CodeUpdated as CodeUpdatedEvent,
  HatChanged as HatChangedEvent,
  HatCreated as HatCreatedEvent,
  InterestPaid as InterestPaidEvent,
  LoansTransferred as LoansTransferredEvent,
  OwnershipTransferred as OwnershipTransferredEvent,
  Transfer as TransferEvent
} from '../generated/RToken/RToken';

import {
  Transaction,
  Account,
  Loan,
  Hat,
  HatMembership,
  Transfer,
  LoanTransferred,
  InterestPaid,
  HatChanged
} from '../generated/schema';

import {
  createEventID,
  createLoanID,
  fetchAccount,
  logTransaction,
  toDai
} from './utils';

// let contract = Contract.bind(event.address)
//
// The following functions can then be called on this contract to access
// state variables and other data:
//
// - contract.ALLOCATION_STRATEGY_EXCHANGE_RATE_SCALE(...)
// - contract.INITIAL_SAVING_ASSET_CONVERSION_RATE(...)
// - contract.MAX_NUM_HAT_RECIPIENTS(...)
// - contract.MAX_UINT256(...)
// - contract.PROPORTION_BASE(...)
// - contract.SELF_HAT_ID(...)
// - contract._guardCounter(...)
// - contract._owner(...)
// - contract.accountStats(...)
// - contract.accounts(...)
// - contract.allowance(...)
// - contract.approve(...)
// - contract.balanceOf(...)
// - contract.changeHat(...)
// - contract.createHat(...)
// - contract.decimals(...)
// - contract.getAccountStats(...)
// - contract.getCurrentAllocationStrategy(...)
// - contract.getCurrentSavingStrategy(...)
// - contract.getGlobalStats(...)
// - contract.getHatByAddress(...)
// - contract.getHatByID(...)
// - contract.getHatStats(...)
// - contract.getMaximumHatID(...)
// - contract.getSavingAssetBalance(...)
// - contract.hatStats(...)
// - contract.ias(...)
// - contract.initialized(...)
// - contract.interestPayableOf(...)
// - contract.isOwner(...)
// - contract.mint(...)
// - contract.mintWithNewHat(...)
// - contract.mintWithSelectedHat(...)
// - contract.name(...)
// - contract.owner(...)
// - contract.payInterest(...)
// - contract.proxiableUUID(...)
// - contract.receivedLoanOf(...)
// - contract.receivedSavingsOf(...)
// - contract.redeem(...)
// - contract.redeemAll(...)
// - contract.redeemAndTransfer(...)
// - contract.redeemAndTransferAll(...)
// - contract.savingAssetConversionRate(...)
// - contract.savingAssetOrignalAmount(...)
// - contract.symbol(...)
// - contract.token(...)
// - contract.totalSupply(...)
// - contract.transfer(...)
// - contract.transferAll(...)
// - contract.transferAllFrom(...)
// - contract.transferAllowances(...)
// - contract.transferFrom(...)

export function handleHatChanged(event: HatChangedEvent): void {
  let account = fetchAccount(event.params.account.toHex());
  account.hat = event.params.newHatID.toString();
  account.save();

  let ev = new HatChanged(createEventID(event));
  ev.transaction = logTransaction(event).id;
  ev.account = event.params.account.toHex();
  ev.hat = event.params.newHatID.toString();
  ev.oldHat = event.params.oldHatID.toString(); // tmp
  ev.save();
}

export function handleHatCreated(event: HatCreatedEvent): void {
  let hat = new Hat(event.params.hatID.toString());
  hat.save();

  let hatstats = RToken.bind(event.address).getHatByID(event.params.hatID);
  let hataccounts = hatstats.value0;
  let hatportions = hatstats.value1;

  for (let i = 0; i < hataccounts.length; ++i) {
    let account = fetchAccount(hataccounts[i].toHex());
    account.save();

    let hatmembership = new HatMembership(
      hat.id.concat('-').concat(i.toString())
    );
    hatmembership.hat = hat.id;
    hatmembership.account = account.id;
    hatmembership.portion = hatportions[i];
    hatmembership.save();
  }
}

export function handleInterestPaid(event: InterestPaidEvent): void {
  // balance is updated by the transfer event
  let ev = new InterestPaid(createEventID(event));
  ev.transaction = logTransaction(event).id;
  ev.account = event.params.recipient.toHex();
  ev.value = toDai(event.params.amount);
  ev.save();
}

export function handleLoansTransferred(event: LoansTransferredEvent): void {
  let ownerAccount = fetchAccount(event.params.owner.toHex());
  ownerAccount.save();

  let recipientAccount = fetchAccount(event.params.recipient.toHex());
  recipientAccount.save();

  let id = createLoanID(ownerAccount.id, recipientAccount.id);
  let delta = event.params.isDistribution
    ? toDai(event.params.redeemableAmount)
    : -toDai(event.params.redeemableAmount);

  let loan = Loan.load(id);
  if (loan == null) {
    loan = new Loan(id);
    loan.owner = ownerAccount.id;
    loan.recipient = recipientAccount.id;
    loan.amount = BigDecimal.fromString('0');
  }
  loan.hat = event.params.hatId.toString();
  loan.amount = loan.amount + delta;
  loan.save();

  let ev = new LoanTransferred(createEventID(event));
  ev.transaction = logTransaction(event).id;
  ev.loan = id;
  ev.value = delta;
  ev.save();
}

export function handleTransfer(event: TransferEvent): void {
  let fromAccount = fetchAccount(event.params.from.toHex());
  fromAccount.balance = toDai(
    RToken.bind(event.address).balanceOf(event.params.from)
  );
  fromAccount.save();

  let toAccount = fetchAccount(event.params.to.toHex());
  toAccount.balance = toDai(
    RToken.bind(event.address).balanceOf(event.params.to)
  );
  toAccount.save();

  let ev = new Transfer(createEventID(event));
  ev.transaction = logTransaction(event).id;
  ev.from = event.params.from.toHex();
  ev.to = event.params.to.toHex();
  ev.value = toDai(event.params.value);
  ev.save();
}

export function handleAllocationStrategyChanged(
  event: AllocationStrategyChangedEvent
): void {}
export function handleApproval(event: ApprovalEvent): void {}
export function handleCodeUpdated(event: CodeUpdatedEvent): void {}
export function handleOwnershipTransferred(
  event: OwnershipTransferredEvent
): void {}
