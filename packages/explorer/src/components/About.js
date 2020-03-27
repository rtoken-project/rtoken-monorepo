import React from 'react';

import croubois from '../assets/croubois.png';

class Navbar extends React.Component {
  render() {
    return (
      <div className="core d-flex">
        <div className="d-flex justify-content-center m-auto">
          <div className="card card-cascade col-lg-6 col-md-9 col-sm-12 m-2 p-0">
            <h5>
              Big thanks to community member Hadrien for getting this party
              started!
            </h5>
            <div className="view view-cascade">
              <img src={croubois} className="card-img-top" alt="profil" />
            </div>
            <div className="card-body card-body-cascade text-center">
              <h4 className="card-title">
                <strong>Hadrien Croubois</strong>
              </h4>
              <p className="card-text">
                I developped this app for the{' '}
                <a href="https://thegraph.com/hackathons/2019/12">
                  2nd thegraph hackathon
                </a>{' '}
                using a dedicated{' '}
                <a href="https://thegraph.com/explorer/subgraph/amxx/rdai">
                  subgraph
                </a>{' '}
                for the backend and apollo/react for the frontend. I am not a
                member of the <a href="https://rdai.money/">rDai</a>{' '}
                developpment team.
              </p>
              <a
                href="https://www.linkedin.com/in/hadriencroubois/"
                className="icons-sm black-text mx-2"
              >
                <i className="fab fa-linkedin-in"> </i>
              </a>
              <a
                href="https://twitter.com/amxx/"
                className="icons-sm black-text mx-2"
              >
                <i className="fab fa-twitter"> </i>
              </a>
              <a
                href="https://github.com/amxx/"
                className="icons-sm black-text mx-2"
              >
                <i className="fab fa-github"> </i>
              </a>
              <a
                href="http://hadriencroubois.eth/"
                className="icons-sm black-text mx-2"
              >
                <i className="fab fa-ethereum"> </i>
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default Navbar;
