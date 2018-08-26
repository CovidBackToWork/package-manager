import React from 'react';

import {Icon, InputIcon} from "./Icons";

class ListItem extends React.Component {
	clickHandler = (event) => {
		this.props.onSelect(this.props.value, this.props.label);
		event.preventDefault();
	};

	render() {
		return (
			<li className="slds-dropdown__item slds-has-icon--left slds-dropdown__item has-icon--left"
				role="menuitem option" tabIndex="0">
				<a href="#" tabIndex="-1" className="slds-truncate" onClick={this.clickHandler}>{this.props.label}</a>
			</li>
		);
	}
}

class Dropdown extends React.Component {
	searchKeyChangeHandler = (e) => {
		this.props.onSearchKeyChange(e.target.value);
	};

	render() {

		let items = this.props.list.map((item) => {
				return <ListItem value={item[this.props.valueField]}
								 label={item[this.props.labelField]}
								 onSelect={this.props.onChange}/>
			}
		);
		return (
			<div className="slds-dropdown slds-dropdown--left slds-dropdown--small slds-dropdown--menu"
				 style={{display: this.props.isOpen ? "inherit" : "none"}}>
				<div className="slds-dropdown__header">
					<div placeholder="Find in list..."
						 className="slds-input-has-icon slds-input-has-icon--left slds-m-bottom--x-small">
						<InputIcon name="search"/>
						<label className="slds-assistive-text" htmlFor="input__filter">Search...</label>
						<input id="input__filter" className="slds-input" type="text" placeholder="Search..."
							   onChange={this.searchKeyChangeHandler}/>
					</div>
				</div>
				<ul className="slds-dropdown__list" role="menu">
					{items}
				</ul>
			</div>
		);
	}
}


export default class extends React.Component {
	constructor(props) {
		super(props);
		this.state = {
			value: undefined,
			label: this.props.label || 'Select an option',
			isOpen: false
		};
	
		this.focusHandler = this.focusHandler.bind(this);
		this.blurHandler = this.blurHandler.bind(this);
		this.changeHandler = this.changeHandler.bind(this);
	}

	// Lifecycle
	render() {
		return (
			<div aria-expanded="true" className="slds-picklist slds-picklist--quickfind" onFocus={this.focusHandler}
				 onBlur={this.blurHandler}>
				<button className="slds-button slds-button--neutral slds-picklist__label" aria-haspopup="true">
					<span className="slds-truncate">{this.state.label}</span>
					<Icon category="utility" name="down"/>
				</button>
				<Dropdown valueField={this.props.valueField}
						  labelField={this.props.labelField}
						  list={this.props.list}
						  isOpen={this.state.isOpen}
						  onSearchKeyChange={this.props.onSearchKeyChange}
						  onChange={this.changeHandler}/>
			</div>
		);
	}
	
	// Handlers
	focusHandler() {
		this.setState({isOpen: true});
	}

	blurHandler(value, label) {
		this.setState({isOpen: false});
	}

	changeHandler(value, label) {
		this.setState({value: value, label: label, isOpen: false});
		this.props.onChange(value, label);
	}
}