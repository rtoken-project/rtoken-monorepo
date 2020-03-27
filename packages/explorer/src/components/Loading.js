import React from 'react';
import '../css/Loading.css';

import rDaiLogo from '../assets/rDai.svg';

class Loading extends React.Component
{
	render()
	{
		return (
			<div id='Loading'>
				<img src={rDaiLogo} alt='logo'/>
			</div>
		);
	}
}

export default Loading;
