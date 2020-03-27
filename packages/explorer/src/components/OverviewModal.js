import React from 'react';
import { Link } from 'react-router-dom';
import { Modal } from 'react-bootstrap';

class OverviewModal extends React.Component
{
	state = {
		view: false,
		data: null,
	}

	componentDidMount()
	{
		this.subscription = this.props.emitter.addListener(
			'viewNode',
			(data) => { this.setState({ data, view: !!data }) }
		);
	}

	componentWillUnmount()
	{
		this.subscription.remove();
	}

	render()
	{
		return (
			<>
				<Modal
					show={ this.state.view }
					onHide={ () => this.setState({ view: false }) }
					autoFocus={false}
					backdrop={false}
					centered
					className='text-light'
				>
					{
						this.state.data &&
						<>
							<Modal.Header closeButton>
								<Modal.Title>
									Account details
								</Modal.Title>
							</Modal.Header>
							<Modal.Body>
								<ul>
									<li>Address: <Link to={`/${this.props.network}/nodeview/${this.state.data.id}`}>{ this.state.data.id }</Link></li>
									<li>Balance: { this.state.data.balance }</li>
									<li>Hat:     { this.state.data.hat ? this.state.data.hat.id : 'unset' }</li>
									{
										this.state.data.loansOwned.length
										?
											<li>Loans Owner:
												<ul>
												{
													this.state.data.loansOwned.map((loan, i) =>
														<li key={i}>Recipient: <Link to={`/${this.props.network}/nodeview/${loan.recipient.id}`}>{loan.recipient.id}</Link> ({loan.amount} rDai)</li>
													)
												}
												</ul>
											</li>
										: null
									}
									{
										this.state.data.loansReceived.length
										?
											<li>Loans Received:
												<ul>
												{
													this.state.data.loansReceived.map((loan, i) =>
														<li key={i}>Owner: <Link to={`/${this.props.network}/nodeview/${loan.owner.id}`}>{loan.owner.id}</Link> ({loan.amount} rDai)</li>
													)
												}
												</ul>
											</li>
										: null
									}
								</ul>
							</Modal.Body>
						</>
					}
				</Modal>
			</>
		);
	}
}

export default OverviewModal;
