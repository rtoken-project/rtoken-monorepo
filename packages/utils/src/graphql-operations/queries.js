import gql from 'graphql-tag';

export const getUserById = gql`
  query getUser($id: Bytes) {
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
