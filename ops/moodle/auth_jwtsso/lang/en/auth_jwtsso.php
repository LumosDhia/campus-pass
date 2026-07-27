<?php
// This file is part of Moodle - http://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// Moodle is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Moodle.  If not, see <http://www.gnu.org/licenses/>.

/**
 * Language strings for auth_jwtsso.
 *
 * @package     auth_jwtsso
 * @copyright   2025 Christopher Reimann
 * @license     http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

$string['allowedalgs'] = 'Allowed algorithms';
$string['allowedalgs_desc'] = 'Comma-separated list (e.g. RS256, ES256).';
$string['audience'] = 'Audience (aud)';
$string['audience_desc'] = 'Expected aud claim. Defaults to this Moodle’s URL.';
$string['autocreate'] = 'Just-in-time user creation';
$string['cachedef_jwks'] = 'JWKS cache';
$string['claim_email'] = 'Claim for email';
$string['claim_username'] = 'Claim for username';
$string['detailedevents'] = 'Enable detailed event logging';
$string['detailedevents_desc'] = 'Logs granular events to aid debugging.';
$string['event_login_completed']  = 'Login completed';
$string['event_login_failed']     = 'Login failed';
$string['event_nonce_created']    = 'Nonce created';
$string['event_token_received']   = 'Token received';
$string['event_token_validated']  = 'Token validated';
$string['event_user_provisioned'] = 'User provisioned';
$string['issuer'] = 'Issuer URL';
$string['issuer_desc'] = 'Expected iss claim. In SP-initiated mode this can be the IdP start/authorize endpoint.';
$string['jwksurl'] = 'JWKS endpoint';
$string['jwksurl_desc'] = 'URL returning a JSON Web Key Set used to validate signatures.';
$string['loginbutton'] = 'Login via external SSO';
$string['noncelifetime'] = 'Nonce lifetime';
$string['noncelifetime_desc'] = 'Validity window for nonces (seconds).';
$string['pluginname'] = 'JWT SSO authentication';
$string['publickey'] = 'Public key (PEM)';
$string['publickey_desc'] = 'Static PEM public key used if JWKS is unavailable.';
$string['settings_desc'] = 'Validate signed JWTs from an external IdP. Supports JWKS or manual PEM public key.';

$string['showbutton'] = 'Show SSO login button on login page';
$string['showbutton_desc'] = 'Adds a button that initiates the SP-initiated flow.';


/* ──────────────────────────────────────────────────────────────
   JWT / validation messages
   ────────────────────────────────────────────────────────────── */
$string['invalidjwt']     = 'Invalid JWT format.';
$string['invalidalg']     = 'Unexpected algorithm: {$a}';
$string['missingkey']     = 'No verification key available (JWKS or manual PEM).';
$string['badsignature']   = 'JWT signature could not be verified.';
$string['missingclaims']  = 'Required claims are missing.';
$string['badissuer']      = 'Unexpected issuer: {$a}';
$string['badaudience']    = 'Unexpected audience: {$a}';
$string['badtime']        = 'Token time window is invalid or expired.';
$string['missingnonce']   = 'Nonce is required.';
$string['invalidnonce']   = 'Nonce is invalid, used, or expired.';
$string['missingemail']   = 'Email claim is required.';
$string['usernotfound']   = 'User not found and auto-create is disabled.';
$string['err_login_failed'] = 'SSO login failed. Please try again or contact support.';

/* ──────────────────────────────────────────────────────────────
   Additional error identifiers used by validator.php
   ────────────────────────────────────────────────────────────── */
$string['badnonce']       = 'Nonce not found or expired.';            // Added for validator nonce DB checks.
$string['noncereplay']    = 'Nonce has already been used (replay detected).'; // Added for replay protection.

/* ──────────────────────────────────────────────────────────────
   Scheduled tasks / privacy
   ────────────────────────────────────────────────────────────── */
$string['task_cleanup_nonces'] = 'Clean expired JWT SSO nonces';

$string['privacy:metadata'] =
    'This plugin stores only transient nonces and JWT IDs for replay protection. They are automatically purged.';
