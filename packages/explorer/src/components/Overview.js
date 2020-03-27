import React from 'react';
import { useQuery } from '@apollo/react-hooks';

import OverviewGraph from './OverviewGraph';
import OverviewModal from './OverviewModal';
import Loading       from './Loading';

import graphql from '../graphql';

const Overview = (props) => {
	// Query subgraph
	const { data, loading, error } = useQuery(graphql.viewNodes);

	// Handle errors
	if (loading) { return <Loading/>;        }
	if (error  ) { return `Error! ${error}`; }

	// Format data - nodes
	const nodes = data.accounts.map(account => ({
		id:      account.id,
		balance: account.balance,
		group:   (account.loansOwned.length > 0 ? 0x1 : 0x0) | (account.loansReceived.length > 0 ? 0x2 : 0x0),
		details: account,
	}));

	// Format data - links
	const links = [].concat(
		...data.accounts.map(account =>
			account.loansOwned.map(loan => ({
				source:  account.id,
				target:  loan.recipient.id,
				amount:  loan.amount,
				details: loan,
			})),
		)
	);

	// render
	return (
		<>
			<OverviewGraph
				data    = {{ nodes, links }}
				emitter = {props.emitter}
				network = {props.network}
				config  = {props.config}
				routing = {props.routing}
			/>
			<OverviewModal
				emitter = {props.emitter}
				network = {props.network}
				config  = {props.config}
				routing = {props.routing}
			/>
		</>
	);
};

export default Overview;
