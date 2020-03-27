import gql from 'graphql-tag';

export default gql`
query
{
	accounts(first: 1000, where: { id_not: "0x0000000000000000000000000000000000000000"})
	{
		id
		balance
		hat
		{
			id
		}
		loansOwned(where: { amount_gt: 0 })
		{
			id
			amount
			recipient {
				id
			}
		}
		loansReceived(where: { amount_gt: 0 })
		{
			id
			amount
			owner {
				id
			}
		}
	}
}
`
