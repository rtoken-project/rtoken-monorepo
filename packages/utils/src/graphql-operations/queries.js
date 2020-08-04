import gql from "graphql-tag";

export const getAccountById = gql`
  query accountById($id: Bytes) {
    account(id: $id) {
      id
      balance
      hat {
        id
      }
      loansOwned(where: { amount_gt: 0 }) {
        id
        amount
        recipient {
          id
        }
      }
      loansReceived(where: { amount_gt: 0 }) {
        id
        amount
        owner {
          id
        }
      }
    }
  }
`;

export const getAllUsersWithHat = gql`
  query allUsersWithHat($id: String) {
    accounts(
      where: { id_not: "0x0000000000000000000000000000000000000000", hat: $id }
    ) {
      id
      balance
      hat {
        id
      }
    }
  }
`;
export const getLoanById = gql`
  query loanById($id: String) {
    loan(id: $id) {
      amount
      interestRedeemed
      sInternal
    }
  }
`;
export const allReceivedLoans = gql`
  query allReceivedLoans($recipient: String) {
    loans(where: { recipient: $recipient }) {
      amount
      interestRedeemed
      sInternal
    }
  }
`;
export const allOwnedLoans = gql`
  query allOwnedLoans($owner: String) {
    loans(where: { owner: $owner }) {
      amount
      interestRedeemed
      sInternal
      recipient
    }
  }
`;
