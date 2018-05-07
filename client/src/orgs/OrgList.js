import React from 'react';
import DataTable from "../components/DataTable";

export default class extends React.Component {
    linkHandler = (e, column, rowInfo, instance) => {
        window.location = "/org/" + rowInfo.row.org_id;
    };

    render() {
        let columns = [
            {Header: "Org ID", accessor: "org_id", sortable: true, clickable: true},
            {Header: "Name", accessor: "name", sortable: true, clickable: true},
            {Header: "Account", accessor: "account_name", sortable: true, clickable: true},
            {Header: "Instance", accessor: "instance", sortable: true},
            {Header: "Edition", accessor: "type", sortable: true},
            {Header: "Type", id: "is_sandbox", accessor: d => d.is_sandbox ? "Sandbox" : "Production", sortable: true}
        ];
        return (
            <DataTable keyField="org_id" id="OrgList" data={this.props.orgs} onFilter={this.props.onFilter} onClick={this.linkHandler} onSelect={this.props.onSelect}  columns={columns}/>
        );
    }
}