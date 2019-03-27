const sfdc = require('../api/sfdcconn');
const db = require('../util/pghelper');
const logger = require('../util/logger').logger;
const orgpackageversions = require('../api/orgpackageversions');
const orgs = require('../api/orgs');

const SELECT_ALL =
	`SELECT OrgName,OrgType,InstalledStatus,InstanceName,OrgStatus,MetadataPackageVersionId,OrgKey,ParentOrg,SystemModstamp
		FROM PackageSubscriber`;

const SELECT_ALL_WITHOUT_MODSTAMP =
	`SELECT OrgName,OrgType,InstalledStatus,InstanceName,OrgStatus,MetadataPackageVersionId,OrgKey,ParentOrg
		FROM PackageSubscriber`;

let adminJob;

/**
 * REQUIRED BEFORE WE CAN USE THIS:
 * 1. Query timeout fix: done in 216 patch
 * 2. ParentOrg: GA in 218
 *
 * Nice to have:
 * 3. SystemModStamp: Behind perm in 216, GA in 220.
 */
async function fetch(fetchAll, job) {
	adminJob = job;
	let packageOrgs = await db.query(`
		SELECT o.org_id, o.name, o.type, p.sfid package_id
		FROM package_org o
		INNER JOIN package p on p.package_org_id = o.org_id
		WHERE o.active = true AND type = '${sfdc.OrgTypes.Package}'`);
	for (let i = 0; i < packageOrgs.length; i++) {
		await fetchFromOrg(packageOrgs[i], fetchAll);
	}
}

async function fetchFromOrg(org, fetchAll) {
	let where = "";
	let invalidateAll = false;
	if (!fetchAll) {
		let latest = await db.query(
			`SELECT MAX(modified_date) FROM org_package_version WHERE package_id = $1`, [org.package_id]);
		if (latest[0].max) {
			where = `WHERE SystemModstamp > ${latest[0].max.toISOString()}`;
		}
	}
	adminJob.postMessage(`Querying orgs from ${org.name}`);

	let res;
	let conn = await sfdc.buildOrgConnection(org.org_id, "45.0");
	try {
		res = await conn.queryWithRetry(`${SELECT_ALL} ${where}`);
		adminJob.postDetail(`Found ${res.totalSize} orgs with parent ${where !== '' ? 'using last modified date' : ''}`);
		invalidateAll = fetchAll;
	} catch (e) {
		if (e.errorCode === 'QUERY_TIMEOUT') {
			return fail(org, e);
		}

		// TODO remove after 220 GA when modstamp is available for all
		logger.warn("Could not query with modstamp", e);

		// Org does not yet support modstamp, so just use parent.
		try {
			res = await conn.queryWithRetry(SELECT_ALL_WITHOUT_MODSTAMP);
			adminJob.postDetail(`Found ${res.totalSize} orgs with parent`);
			invalidateAll = true; // Not using modstamp, so always invalidate
		} catch (e) {
			return fail(org, e);
		}
	}

	let recs = await load(res, conn);

	if (recs.length === 0)
		return;

	if (invalidateAll) {
		// Invalidate all existing when we are upserting all new findings
		await db.update(`UPDATE org_package_version set license_status = $1
					WHERE package_id = $2`, [orgpackageversions.LicenseStatus.NotFound, org.package_id]);
	}

	adminJob.postDetail(`Storing ${recs.length} orgs`);
	await upsert(recs, 2000);
}

function fail(org, e) {
	adminJob.postDetail(`Failed to retrieve orgs from ${org.name}`, e);
}
async function fetchMore(nextRecordsUrl, conn, recs) {
	let result = await conn.requestGet(nextRecordsUrl);
	return recs.concat(await load(result, conn));
}

async function load(result, conn) {
	let recs = result.records.map(v => {
		return {
			org_id: v.OrgKey,
			name: v.OrgName,
			parent_org_id: v.ParentOrg,
			instance: v.InstanceName,
			is_sandbox: v.OrgType === "Sandbox",
			type: v.OrgType,
			status: v.InstalledStatus === "i" ? orgs.Status.Installed : orgs.Status.NotInstalled,
			package_version_id: v.MetadataPackageVersionId,
			modified_date: v.SystemModstamp
		};
	});
	if (!result.done && !adminJob.canceled) {
		return await fetchMore(result.nextRecordsUrl, conn, recs);
	}
	return recs;
}

async function upsert(recs, batchSize) {
	let count = recs.length;
	if (count === 0) {
		return; // nothing to see here
	}
	for (let start = 0; start < count && !adminJob.canceled;) {
		await upsertBatch(recs.slice(start, start += batchSize));
	}
}

async function upsertBatch(recs) {
	let values = [];
	let sql = "INSERT INTO org (org_id, name, instance, is_sandbox, type, status, modified_date, parent_org_id) VALUES";
	for (let i = 0, n = 1; i < recs.length; i++) {
		let rec = recs[i];
		if (i > 0) {
			sql += ','
		}
		sql += `($${n++},$${n++},$${n++},$${n++},$${n++},$${n++},$${n++},$${n++})`;
		values.push(rec.org_id, rec.name, rec.instance, rec.is_sandbox, rec.type, rec.status, rec.modified_date, rec.parent_org_id);
	}
	sql += ` on conflict (org_id) do update set name = excluded.name, instance = excluded.instance, type = excluded.type, 
				status = excluded.status, modified_date = excluded.modified_date, parent_org_id = excluded.parent_org_id`;
	await db.insert(sql, values);

	const opvs = recs.map(rec => {
		return {
			org_id: rec.org_id,
			version_id: rec.package_version_id,
			license_status: orgpackageversions.LicenseStatus.Active,
			modified_date: rec.modified_date
		}
	});
	await orgpackageversions.insertOrgPackageVersions(opvs);
}

async function fetchOrgVersions(orgIds, packageOrgIds, job) {
	adminJob = job;
	orgIds = Array.isArray(orgIds) ? orgIds : [orgIds];

	if (!packageOrgIds) {
		packageOrgIds = (await db.query(
			`SELECT org_id from package_org where type = $1`, [sfdc.OrgTypes.Package])).map(p => p.org_id);
	}
	const missingOrgIds = new Set(orgIds);

	job.postDetail(`Querying ${packageOrgIds.length} org connections`);
	let arrs = await push.bulkFindSubscribersByIds(packageOrgIds, orgIds);
	let opvs = [];
	for (let i = 0; i < arrs.length; i++) {
		const arr = arrs[i];
		if (!Array.isArray(arr)) {
			// Error!
			job.postDetail(`Error: ${arr}`);
			continue;
		}

		opvs = opvs.concat(arr.map(rec => {
			// Found! So remove from missing list and add as an Active license
			const orgId = sfdc.normalizeId(rec.OrgKey);
			missingOrgIds.delete(orgId);
			return {
				org_id: orgId,
				version_id: rec.MetadataPackageVersionId,
				license_status: orgpackageversions.LicenseStatus.Active
			}
		}));
	}
	job.postDetail(`Fetched ${opvs.length} package subscribers, with ${missingOrgIds.size} missing orgs`);
	missingOrgIds.forEach((value) => {
		opvs.push({
			version_id: null,
			org_id: value,
			license_status: orgpackageversions.LicenseStatus.NotFound
		});
	});
	if (opvs.length > 0) {
		let res = await orgpackageversions.insertOrgPackageVersions(opvs);
		job.postDetail(`Updated ${res.length} org package versions`);
	}
}

exports.fetch = fetch;
exports.fetchOrgVersions = fetchOrgVersions;