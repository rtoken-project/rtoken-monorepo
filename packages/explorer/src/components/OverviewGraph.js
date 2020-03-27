import React from 'react';
import { ForceGraph3D } from 'react-force-graph';

const OverviewGraph = (props) => {
	const fgRef     = React.useRef();
	const [ state ] = React.useState({ id:null, anchor: null });

	// zoom view
	const viewZoom = React.useCallback(node => {
		// save state
		if (!state.anchor)
		{
			state.anchor = fgRef.current.cameraPosition();
		}
		state.id = node.id;
		// move camera
		const distRatio = 1 + 50 / Math.hypot(node.x, node.y, node.z);
		fgRef.current.cameraPosition(
			{ x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio },
			{ x: node.x,             y: node.y,             z: node.z             },
			1000
		);
		props.emitter.emit('viewNode', node.details);

	}, [fgRef, props, state]);

	// reset view
	const viewReset = React.useCallback(() => {
		if (state.anchor)
		{
			// reset camera
			fgRef.current.cameraPosition(
				{ x: state.anchor.x, y: state.anchor.y, z: state.anchor.z },
				state.anchor.lookAt,
				1000
			);
			// reset state
			state.anchor = null;
			state.id     = null;
			props.emitter.emit('viewNode', null);
		}
	}, [fgRef, props, state]);

	// handler
	const handleClick = React.useCallback(node => {
		if (!node || node.id === state.id)
		{
			viewReset(node);
		}
		else
		{
			viewZoom(node);
		}
	}, [state, viewZoom, viewReset]);

	const handleRightClick = React.useCallback(node => {
		window.location.href = `https://etherscan.io/address/${node.id}`
	}, []);

	// render
	return <ForceGraph3D
		ref                               = { fgRef }
		graphData                         = { props.data }
		enableNodeDrag                    = { false }
		nodeLabel                         = { n => n.id }
		nodeVal                           = { n => Math.log(1+n.balance) }
		nodeAutoColorBy                   = { n => n.group }
		nodeOpacity                       = { 1 }
		nodeResolution                    = { 16 }
		linkCurvature                     = { 0.5 }
		// linkWidth                         = { l => Math.log(1+l.amount) }
		linkDirectionalParticles          = { l => Math.log(1+l.amount) }
		linkDirectionalParticleWidth      = { l => Math.log(1+Math.log(1+l.amount)) }
		linkDirectionalParticleResolution = { 8 }
		onNodeClick                       = { (node) => handleClick(node) }
		onNodeRightClick                  = { (node) => handleRightClick(node) }
		onLinkClick                       = { (link) => handleClick(null) }
		onBackgroundClick                 = { ()     => handleClick(null) }
		backgroundColor                   = "#111111"
	/>;
}

export default OverviewGraph;
