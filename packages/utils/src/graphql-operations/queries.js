import gql from 'graphql-tag';

export const getAccountById = gql`
  query account($id: Bytes) {
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
