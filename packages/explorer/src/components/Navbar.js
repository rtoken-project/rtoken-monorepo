import React from 'react';
import { ethers } from 'ethers';
import {
  MDBIcon,
  MDBNavbar,
  MDBNavbarBrand,
  MDBNavbarNav,
  MDBNavItem,
  MDBNavLink,
  MDBNavbarToggler,
  MDBCollapse,
  MDBFormInline,
  MDBDropdown,
  MDBDropdownToggle,
  MDBDropdownMenu,
  MDBDropdownItem
} from 'mdbreact';

import rDaiLogo from '../assets/rDai.svg';

class Navbar extends React.Component {
  state = {
    isOpen: false,
    search: ''
  };

  toggleCollapse() {
    this.setState({ isOpen: !this.state.isOpen });
  }

  updateSearch(ev) {
    this.setState({ search: ev.target.value });
  }

  submit(event) {
    event.preventDefault();

    ethers
      .getDefaultProvider('mainnet')
      .resolveName(this.state.search)
      .then(address => {
        if (address) {
          this.props.emitter.emit(
            'goTo',
            `/${this.props.network}/nodeview/${address.toLowerCase()}`
          );
        } else {
          console.erro(`'${this.state.search}' is not a valid address`);
        }
      })
      .catch(console.error);
  }

  render() {
    return (
      <MDBNavbar color="black" dark expand="md" fixed="top">
        <MDBNavbarBrand>
          <img src={rDaiLogo} alt="logo" className="navLogo" />
          <strong className="white-text">rDai explorer</strong>
        </MDBNavbarBrand>
        <MDBNavbarToggler onClick={this.toggleCollapse.bind(this)} />
        <MDBCollapse id="navbarCollapse" isOpen={this.state.isOpen} navbar>
          <MDBNavbarNav left>
            <MDBNavItem>
              <MDBNavLink link to={`/${this.props.network}/Overview`}>
                Overview
              </MDBNavLink>
            </MDBNavItem>
            <MDBNavItem>
              <MDBNavLink link to={`/${this.props.network}/about`}>
                About
              </MDBNavLink>
            </MDBNavItem>
          </MDBNavbarNav>
          <MDBNavbarNav right>
            <MDBNavItem>
              <MDBFormInline waves onSubmit={this.submit.bind(this)}>
                <div className="md-form my-0">
                  <input
                    type="text"
                    placeholder="Search"
                    aria-label="Search"
                    onChange={this.updateSearch.bind(this)}
                    className="form-control mr-sm-2"
                  />
                </div>
              </MDBFormInline>
            </MDBNavItem>
            <MDBNavItem>
              <MDBDropdown>
                <MDBDropdownToggle nav caret>
                  <MDBIcon icon="globe" />
                </MDBDropdownToggle>
                <MDBDropdownMenu className="dropdown-default">
                  {Object.entries(this.props.config.networks).map(
                    ([key, value]) => (
                      <MDBDropdownItem
                        key={key}
                        href="#!"
                        onClick={() =>
                          this.props.emitter.emit('switchNetwork', key)
                        }
                      >
                        {key}
                      </MDBDropdownItem>
                    )
                  )}
                </MDBDropdownMenu>
              </MDBDropdown>
            </MDBNavItem>
          </MDBNavbarNav>
        </MDBCollapse>
      </MDBNavbar>
    );
  }
}

export default Navbar;
