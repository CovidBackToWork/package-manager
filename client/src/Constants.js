export const UPGRADE_ICON = {name: "custom92", category: "custom"};
export const UPGRADE_ITEM_ICON = {name: "custom25", category: "custom"};
export const UPGRADE_JOB_ICON = {name: "custom44", category: "custom"};
export const ORG_ICON = {name: "account", category: "standard"};
export const ORG_GROUP_ICON = {name: "groups", category: "standard"};
export const PACKAGE_ORG_ICON = {name: "process", category: "standard"};
export const LICENSE_ICON = {name: "drafts", category: "standard"};
export const PACKAGE_ICON = {name: "thanks", category: "standard"};
export const PACKAGE_VERSION_ICON = {name: "custom72", category: "custom"};
export const ADMIN_ICON = {name: "calibration", category: "standard"};
export const AUTH_ICON = {name: "people", category: "standard"};

export const Status = {
	Created: "Created", Pending: "Pending", InProgress: "InProgress", 
	Succeeded: "Succeeded", Failed: "Failed", Canceled: "Canceled", Invalid: "Invalid",
	Ineligible: "Ineligible"
};

export const getProgress = statusRecs => {
	if (!statusRecs || statusRecs.length === 0)
		return {count: 0, active: 0, started: 0, completed: 0, errors: 0, cancelled: 0, percentage: 0, done: 0};

	let count = statusRecs.length, active = 0, started = 0, completed = 0, errors = 0, cancelled = 0;
	for (let i = 0; i < statusRecs.length; i++) {
		let rec = statusRecs[i];
		switch (rec.status) {
			case Status.Ineligible:
				count--;
				break;
			case Status.Failed:
				active++;
				started++;
				completed++;
				errors++;
				break;
			case Status.Canceled:
				active++;
				started++;
				completed++;
				cancelled++;
				break;
			case Status.Created:
				break;
			case Status.Pending:
				active++;
				break;
			case Status.InProgress:
				active++;
				started++;
				break;
			case Status.Succeeded:
				active++;
				started++;
				completed++;
				break;
			case Status.Invalid:
				started++;
				completed++;
				break;
		}
	}
	const percentage = (started + completed) / (count * 2);
	const done = percentage === 1 || count === 0;
	return {count, active, started, completed, errors, cancelled, percentage, done};
};

export const GroupTypes = [
	{name:"Upgrade Group", label:"Upgrade Groups"},
	{name:"Blacklist", label:"Blacklists"},
	{name:"Whitelist", label:"Whitelists"}
];
