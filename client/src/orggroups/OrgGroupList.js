import React from 'react';
import DataTable from "../components/DataTable";
import moment from "moment";

export default class extends React.Component {
	linkHandler = (e, column, rowInfo) => {
		window.location = "/orggroup/" + rowInfo.original.id;
	};

	render() {
		const columns = [
			{Header: "Name", accessor: "name", sortable: true, clickable: true},
			{Header: "Description", accessor: "description", clickable: true},
			{Header: "Created", id: "created_date", maxWidth: 200, accessor: d => d.created_date ? moment(d.created_date).format("YYYY-MM-DD HH:mm:ss A") : null, clickable: true},
			{Header: "When", id: "when", maxWidth: 200, accessor: d => d.created_date ? moment(d.created_date).fromNow() : null, clickable: true, sortable: false}
		];
		return (
			<DataTable id="OrgGroupList" data={this.props.orggroups} onClick={this.linkHandler}
					   onFilter={this.props.onFilter} onSelect={this.props.onSelect} columns={columns}/>
		);
	}
}