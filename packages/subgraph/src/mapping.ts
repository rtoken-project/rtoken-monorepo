import { BigInt, Bytes, Address } from '@graphprotocol/graph-ts';
import {
  RToken,
  AllocationStrategyChanged,
  Approval,
  CodeUpdated,
  HatChanged,
  HatCreated,
  InterestPaid,
  LoansTransferred,
  OwnershipTransferred,
  Transfer
} from '../generated/RToken/RToken';
import { CompoundAllocationStrategy } from '../generated/RToken/CompoundAllocationStrategy';
import { User, Loan } from '../generated/schema';

// TODO: Add global stats to track total rDAI interest sent to an external account
// TODO: remove general functions

export function handleInterestPaid(event: InterestPaid): void {
  let entity = loadUser(event.transaction.from.toHex());

  entity.totalInterestPaid = entity.totalInterestPaid + event.params.amount;

  // Check if interest was earned by self-hat

  // Check all accounts sending interest to this address
  // Calculate the amounts which each address has sent?

  entity.save()
}

export function handleHatChanged(event: HatChanged): void {
  // let entity = loadUser(event.transaction.from.toHex());
  //
  // // Inspect the new hat recipients
  // let contract = Contract.bind(event.address);
  // let recipients = contract.getHatByID(event.params.newHatID).value0;
  // recipients = recipients.forEach(item => item);
  // // add any new recipients to the array
  // let oldRecipients = entity.recipientsList;
  // let newRecipients = recipients.concat(
  //   recipients.filter(item => oldRecipients.indexOf(item) < 0)
  // );
  // entity.recipientsList = newRecipients;
  //
  // entity.save();
}

// Load all the sources of incoming interest
// internal

// external

// Sum it all up

// Multiply each person's balance by their proportion to get weighted contribution.

export function handleApproval(event: Approval): void {}

export function handleCodeUpdated(event: CodeUpdated): void {}

export function handleHatCreated(event: HatCreated): void {}

export function handleLoansTransferred(event: LoansTransferred): void {
  // Info: Event parameters:
  // LoansTransferred(owner, recipient, hatID,
  //     isDistribution,
  //     redeemableAmount,
  //     internalSavingsAmount);

  // Load user entities
  let fromBytes = event.params.owner;
  let from = fromBytes.toHex();
  let userFrom = loadUser(from);
  let sentAddressList = userFrom.sentAddressList;

  let toBytes = event.params.recipient;
  let to = toBytes.toHex();
  let userTo = loadUser(to);
  let receivedAddressList = userTo.receivedAddressList;

  // Get event details
  let isDistribution = event.params.isDistribution;
  let sInternalAmount = event.params.internalSavingsAmount;
  let redeemableAmount = event.params.redeemableAmount;
  let iasContract = CompoundAllocationStrategy.bind(
    RToken.bind(event.address).ias()
  );
  let exchangeRateStored = iasContract.exchangeRateStored();

  // Load loan entity
  let loan = loadLoan(
    from,
    to,
    event.block.timestamp.toString(),
    exchangeRateStored
  );

  // Check if this is a new loan
  let isNewLoan = true;
  for (let i: i32 = 0; i < receivedAddressList.length; i++) {
    if (receivedAddressList[i].toHex() === from) {
      isNewLoan = false;
      break;
    }
  }
  // If this is a new loan, add the addresses to the User's arrays
  if (isNewLoan) {
    sentAddressList.push(toBytes);
    userFrom.sentAddressList = sentAddressList;
    userFrom.save();
    receivedAddressList.push(fromBytes);
    userTo.receivedAddressList = receivedAddressList;
    userTo.save();
  }

  // Update loan details
  loan.redeemableAmount = redeemableAmount;
  let newSInternal = loan.sInternalAmount - sInternalAmount;
  if (isDistribution) {
    newSInternal = loan.sInternalAmount + sInternalAmount;
  }
  loan.sInternalAmount = newSInternal;
  loan.save();

  // You know how much cDAI you've received from whome
  // You don't know exchange rate between cDAI and rDAI
  // redeemable amount is the amount I need to pay back
  // sInternal is how much I get to keep
  // Can use allocation strategy to get exchange rate
}

export function handleOwnershipTransferred(event: OwnershipTransferred): void {}

export function handleAllocationStrategyChanged(
  event: AllocationStrategyChanged
): void {}

export function handleTransfer(event: Transfer): void {}

function loadUser(address: String): User | null {
  let entity = User.load(address);

  if (entity == null) {
    entity = new User(address);
    entity.totalInterestPaid = new BigInt(0);
    entity.receivedAddressList = [];
    entity.sentAddressList = [];
  }

  return entity;
}

function loadLoan(
  from: String,
  to: String,
  currentTime: String,
  rate: BigInt
): Loan | null {
  let loanId = getLoanID(from, to);
  let entity = Loan.load(loanId);
  if (entity == null) {
    entity = new Loan(loanId);
    entity.from = from;
    entity.to = to;
    entity.timeStarted = currentTime;
    entity.interestRateFloor = rate;
    entity.redeemableAmount = new BigInt(0);
    entity.sInternalAmount = new BigInt(0);
  }

  return entity;
}

// Returns "<fromAddress>-<toAddress>"
function getLoanID(from: String, to: String): String {
  let fromString = from.toString().concat('-');
  let toString = to.toString();
  return fromString.concat(toString);
}
