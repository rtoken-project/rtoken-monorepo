import { BigInt, BigDecimal, EthereumEvent } from '@graphprotocol/graph-ts';

import { Account, Loan, Transaction } from '../generated/schema';

export function createEventID(event: EthereumEvent): string {
  return event.block.number
    .toString()
    .concat('-')
    .concat(event.logIndex.toString());
}

export function createLoanID(owner: string, recipient: string): string {
  return owner.concat('-').concat(recipient);
}

export function fetchAccount(id: string): Account {
  let account = Account.load(id);
  if (account == null) {
    account = new Account(id);
    account.balance = BigDecimal.fromString('0');
  }
  return account as Account;
}

export function logTransaction(event: EthereumEvent): Transaction {
  let tx = new Transaction(event.transaction.hash.toHex());
  tx.timestamp = event.block.timestamp;
  tx.blockNumber = event.block.number;
  tx.save();
  return tx as Transaction;
}

export function toDai(value: BigInt): BigDecimal {
  return value.divDecimal(BigDecimal.fromString('1000000000000000000')); // 18 decimal
}
