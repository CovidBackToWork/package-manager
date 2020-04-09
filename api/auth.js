'use strict';

const jsforce = require('jsforce');
const qs = require('query-string');
const sfdc = require('./sfdcconn');
const packageorgs = require('./packageorgs');
const {sanitizeIt} = require("../util/strings");
const logger = require('../util/logger').logger;

// Configurable parameters
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;

const LOCAL_URL = process.env.LOCAL_URL || 'http://localhost';
const PORT = process.env.PORT || 5000;
const CLIENT_PORT = process.env.CLIENT_PORT || PORT;
const API_URL = process.env.API_URL || `${LOCAL_URL}:${PORT}`;
const CLIENT_URL = process.env.CLIENT_URL || `${LOCAL_URL}:${CLIENT_PORT}`;
const CALLBACK_URL = process.env.CALLBACK_URL || `${API_URL}/oauth2/callback`;
const AUTH_URL = process.env.AUTH_URL;

// Constants
const PROD_LOGIN = "https://login.salesforce.com";

function requestLogout(req, res, next) {
    try {
        req.session = null;
        return res.send({result: 'ok'});
    } catch (e) {
        next(e);
    }
}

function oauthLoginURL(req, res, next) {
    try {
        const url = buildURL('api id web', {
            operation: "login",
            loginUrl: AUTH_URL || sfdc.KnownOrgs[sfdc.OrgTypes.Licenses] ? sfdc.KnownOrgs[sfdc.OrgTypes.Licenses].instanceUrl : null,
            returnTo: req.query.returnTo
        });
        res.json(url);
    } catch (e) {
        next(e);
    }
}

function oauthOrgURL(req, res, next) {
    try {
        const url = buildURL("api id web refresh_token", {
            operation: "org",
            type: req.query.type,
            loginUrl: req.query.instanceUrl ? req.query.instanceUrl : PROD_LOGIN,
            returnTo: req.query.returnTo
        });
        res.json(url);
    } catch (e) {
        next(e);
    }
}

function buildURL(scope, state) {
    let conn = buildAuthConnection(undefined, undefined, state.loginUrl);
    return conn.oauth2.getAuthorizationUrl({scope: scope, prompt: 'login', state: JSON.stringify(state)});
}

async function oauthCallback(req, res, next) {
    let state = JSON.parse(req.query.state);
    let conn = buildAuthConnection(null, null, state.loginUrl);
    try {
        if (req.query.error) {
            let errs = {
                message: req.query.error_description,
                severity: "Error",
                code: req.query.error
            };

            res.redirect(`${CLIENT_URL}/authresponse?${qs.stringify(errs)}`);
            return;
        }
        let userInfo = await conn.authorize(req.query.code);
        let url = CLIENT_URL;
        let returnTo = sanitizeIt(state.returnTo);
        if (returnTo) {
            url += returnTo;
        }
        switch (state.operation) {
            case "org":
                await packageorgs.initOrg(conn, userInfo.organizationId, state.type);
                res.redirect(url);
                break;
            default:
                const user = await conn.identity();
                req.session.username = user.username;
                req.session.display_name = user.display_name;
                req.session.access_token = conn.accessToken;
                res.redirect(url);
        }
    } catch (error) {
        logger.error("Failed to authorize user", error);
        let errs = {
            message: error.message,
            severity: error.severity,
            code: error.code
        };

        res.redirect(`${CLIENT_URL}/authresponse?${qs.stringify(errs)}`);
        next(error);
    }
}

async function requestUser(req, res, next) {
    if (!req.session.access_token) {
        return; // Not logged in.
    }
    const conn = buildAuthConnection(req.session.access_token);
    try {
        let user = await conn.identity();
        // If user has a permission set granting edit rights on the Package Version object, we consider them admins
        const perms = await conn.query(`SELECT Id FROM ObjectPermissions WHERE ParentId
                    IN (SELECT PermissionSetId FROM PermissionSetAssignment WHERE AssigneeId = '${user.user_id}') AND
                    PermissionsEdit = true AND SobjectType = 'sfLma__Package_Version__c'`);
        user.read_only = perms.totalSize === 0;

        // Store additional settings on user session object that the UI may need
        user.enforce_activation_policy = process.env.ENFORCE_ACTIVATION_POLICY;
        user.enable_sumo = !!process.env.SUMO_URL;
        res.json(user);
    } catch (e) {
        logger.error("Failed to identify current user", e);
        next(e);
    }
}

function buildAuthConnection(accessToken, refreshToken, loginUrl = PROD_LOGIN) {
    return new jsforce.Connection({
            oauth2: {
                loginUrl: loginUrl,
                clientId: CLIENT_ID,
                clientSecret: CLIENT_SECRET,
                redirectUri: CALLBACK_URL
            },
            version: sfdc.SFDC_API_VERSION,
            instanceUrl: AUTH_URL || (sfdc.KnownOrgs[sfdc.OrgTypes.Licenses] ? sfdc.KnownOrgs[sfdc.OrgTypes.Licenses].instanceUrl : loginUrl),
            accessToken: accessToken,
            refreshToken: refreshToken,
            logLevel: process.env.LOG_LEVEL || "WARN"
        }
    );
}

exports.requestUser = requestUser;
exports.requestLogout = requestLogout;
exports.oauthLoginURL = oauthLoginURL;
exports.oauthOrgURL = oauthOrgURL;
exports.oauthCallback = oauthCallback;
