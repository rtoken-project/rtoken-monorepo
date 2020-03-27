import React from 'react';
import { useQuery } from '@apollo/react-hooks';
import { ForceGraph2D } from 'react-force-graph';

// TODO NodeviewGraph
import Loading from './Loading';

import graphql from '../graphql';

const Overview = (props) => {

	const handleClick = React.useCallback(node => {
		if (node.address)
		{
			props.emitter.emit('goTo', `/${props.network}/nodeview/${node.address}`);
		}
	}, [props]);

	const handleRightClick = React.useCallback(node => {
		if (node.address)
		{
			window.location.href = `https://etherscan.io/address/${node.address}`
		}
	}, []);

	// Query subgraph
	const { data, loading, error } = useQuery(
		graphql.viewNode,
		{
			variables:
			{
				address: props.routing.match.params.address
			}
		}
	);

	// Handle errors
	if (loading)
	{
		return <Loading/>;
	}
	if (error)
	{
		console.error(error);
		return null;
	}

	// format data
	/*
	const totalValue = [
		...data.account.loansOwned.map(l => parseFloat(l.amount)),
		...data.account.loansReceived.map(l => parseFloat(l.amount)),
	].reduce((x,y) => x+y, 0);
	*/

	let nodes, links;
	if (data.account)
	{
		const ownedValue = {}, receivedValue = {};
		for (const loan of data.account.loansOwned)
		{
			ownedValue[loan.hat ? loan.hat.id : 0] |= 0;
			ownedValue[loan.hat ? loan.hat.id : 0] += parseFloat(loan.amount);
		}

		for (const loan of data.account.loansReceived)
		{
			receivedValue[loan.hat ? loan.hat.id : 0] |= 0;
			receivedValue[loan.hat ? loan.hat.id : 0] += parseFloat(loan.amount);
		}

		nodes = [
			...[...new Set([
				data.account.id,
				...data.account.loansReceived.map(l => l.owner.id),
				...data.account.loansOwned.map   (l => l.recipient.id),
			])].map(id => ({
				id:      id,
				label:   id,
				address: id,
				color:   id === data.account.id ? null : "#444444",
				size:    id === data.account.id ? 3    : 2,
			})),
			...[...new Set([
				...data.account.loansReceived.map(l => l.hat ? l.hat.id : "0"),
				...data.account.loansOwned.map   (l => l.hat ? l.hat.id : "0"),
			])].map(id => ({
				id:      id,
				label:   `hat ${id}`,
				color:   "#888888",
				size:    1,
			})),
		];

		links = [
			...Object.entries(ownedValue).map(([id, value]) => ({
				source: data.account.id,
				target: id,
				label:  `${value} rDai`,
				size:   value,
			})),
			...Object.entries(receivedValue).map(([id, value]) => ({
				source: id,
				target: data.account.id,
				label:  `${value} rDai`,
				size:   value,
			})),
			...data.account.loansReceived.filter(l => l.owner.id !== data.account.id).map(l => ({
				source: l.owner.id,
				target: l.hat ? l.hat.id : "0",
				label:  `${l.amount} rDai`,
				size:   l.amount,
			})),
			...data.account.loansOwned.filter(l => l.recipient.id !== data.account.id).map(l => ({
				source: l.hat ? l.hat.id : "0",
				target: l.recipient.id,
				label:  `${l.amount} rDai`,
				size:   l.amount,
			})),
		];
	}
	else
	{
		nodes = [{
			id:      props.match.params.address,
			label:   props.match.params.address,
			address: props.match.params.address,
			size:    3
		}];
		links = [];
	}

	// render
	return (
		<>
			<ForceGraph2D
				graphData                    = {{ nodes, links }}
				nodeLabel                    = { n => n.label }
				nodeVal                      = { n => n.size }
				nodeAutoColorBy              = { n => n.group }
				linkLabel                    = { n => n.label }
				// linkWidth                    = { l => Math.log(1+l.size) }
				linkDirectionalParticles     = { l => Math.log(1+l.size) }
				linkDirectionalParticleWidth = { l => Math.log(1+Math.log(1+l.size)) }
				linkCurvature                = { 0.5 }
				onNodeClick                  = { (node) => handleClick(node) }
				onNodeRightClick             = { (node) => handleRightClick(node) }
				backgroundColor              = "#FFFFFF"
			/>;
		</>
	);
};

export default Overview;
