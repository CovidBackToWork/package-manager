import React from 'react';

import DataTable from "../components/DataTable";
import moment from "moment";

export default class extends React.Component {
    state = {upgrades: []};

    componentWillReceiveProps(props) {
        if (props.upgrades) {
            this.setState({upgrades: props.upgrades});
        }
    }

    linkHandler = (e, column, rowInfo) => {
        if (rowInfo) {
            window.location = "/upgrade/" + rowInfo.row.id;
        }
    };

    render() {
        let columns = [
            {Header: "Number", accessor: "id", minWidth: 30, sortable: true, clickable: true},
            {Header: "Description", accessor: "description", minWidth: 300, clickable: true},
            {Header: "Scheduled Start Time", id: "start_time", accessor: d => moment(d.start_time).format("lll"), sortable: true, clickable: true},
            {Header: "Created By", accessor: "created_by", sortable: true},
            {Header: "Items", accessor: "item_count", sortable: true}
        ];
        return (
            <DataTable id="UpgradeList" data={this.state.upgrades} onFilter={this.props.onFilter} onClick={this.linkHandler} columns={columns}/>
        );
    }
}