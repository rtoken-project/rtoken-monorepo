import React from 'react';
import { Router, Route, Redirect } from 'react-router-dom';
import { createBrowserHistory as createHistory } from 'history'
import { EventEmitter   } from 'fbemitter';

import config       from '../config';
import App          from './App';

class Wrapper extends React.Component
{
	state = {
		history: createHistory(),
		emitter: new EventEmitter(),
	}

	componentDidMount()
	{
		this.subscription_route   = this.state.emitter.addListener('goTo',          this.goTo.bind(this));
		this.subscription_network = this.state.emitter.addListener('switchNetwork', this.switchNetwork.bind(this));
	}

	componentWillUnmount()
	{
		this.subscription_route.remove();
		this.subscription_network.remove();
	}

	switchNetwork(network)
	{
		this.goTo(this.state.history.location.pathname.replace(/\w+/, network));
	}

	goTo(route)
	{
		this.state.history.push(route);
	}

	render()
	{
		return (
			<Router history={this.state.history}>
				<Route exact path='/'><Redirect to={`/${Object.keys(config.networks).find(Boolean)}`}/></Route>
				<Route path='/:network' render={ (props) => <App emitter={this.state.emitter} config={config} routing={props}/> } />
			</Router>
		);
	}
}

export default Wrapper;
