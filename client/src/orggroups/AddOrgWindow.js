import React from 'react';
import {FormHeader} from "../components/PageHeader";
import {ORG_ICON} from "../Constants";
import * as packageOrgService from '../services/PackageOrgService';

export default class extends React.Component {
    state = {
        orgIds: [],
        isAdding: false,
        orgs: ""
    };

    componentDidMount() {
        packageOrgService.requestAll({field: "name", direction: "desc"}).then(packageOrgs => this.setState({packageOrgs}));
    }
    
    onAdd = () => {
        this.setState({isAdding: true});
        this.props.onSave(this.state.orgIds);    
    };
    
    orgsChangeHandler = (event) => {
        this.setState({orgs: event.target.value});
    };

    orgsBlurHandler = (event) => {
        let vals = event.target.value.replace(/[ \t\r\n\f'"]/g, ",").split(",").map(v => v.substring(0,15));
        let orgIdSet = new Set(vals.filter(elem => elem !== "" && (elem.length === 15 && elem.startsWith("00D"))));
        let orgIds = Array.from(orgIdSet);
        this.setState({orgIds: orgIds, orgs: orgIds.join(", ")});
    };

    render() {
        const actions = [
            {handler: this.onAdd, spinning: this.state.isAdding, label: "Add"},
            {handler: this.props.onCancel, label: "Cancel"}
        ];
        
        return (
            <div>
                <div className="slds-modal slds-fade-in-open">
                    <div className="slds-modal__container">
                        <FormHeader type="Orgs" icon={ORG_ICON} title="Import orgs" actions={actions}/>
                        <div className="slds-modal__content slds-p-around_medium">
                            <div className="slds-form slds-form_stacked slds-wrap  slds-m-around--medium">
                                <div className="slds-form-element">
                                    <label className="slds-form-element__label" htmlFor="org_ids">Org Ids</label>
                                    <div className="slds-form-element__control">
                                        <textarea className="slds-textarea"
                                                  placeholder="Comma, space or newline-delimited list of valid org ids"
                                                  id="org_id_import" value={this.state.orgs} rows="7"
                                                  onChange={this.orgsChangeHandler} onBlur={this.orgsBlurHandler}/>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="slds-modal-backdrop slds-modal-backdrop--open"/>
            </div>
        );
    }
}
