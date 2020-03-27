import gql from 'graphql-tag';

export default gql`
query node($address: String)
{
	account(id: $address)
	{
		id
		balance
		loansOwned(where: { amount_gt: 0 })
		{
			amount
			owner
			{
				id
			}
			recipient
			{
				id
			}
			hat
			{
				id
			}
		}
		loansReceived(where: { amount_gt: 0 })
		{
			amount
			owner
			{
				id
			}
			recipient
			{
				id
			}
			hat
			{
				id
			}
		}
	}
}
`
