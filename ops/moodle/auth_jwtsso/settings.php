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
 * Settings for auth_jwtsso.
 *
 * @package     auth_jwtsso
 * @category    admin
 * @copyright   2025 Christopher Reimann
 * @license     http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();
global $CFG;

if ($ADMIN->fulltree) {
    $settings->add(new admin_setting_heading(
        'auth_jwtsso/heading',
        get_string('pluginname', 'auth_jwtsso'),
        get_string('settings_desc', 'auth_jwtsso')
    ));

    $settings->add(new admin_setting_configtext(
        'auth_jwtsso/issuer',
        get_string('issuer', 'auth_jwtsso'),
        get_string('issuer_desc', 'auth_jwtsso'),
        '',
        PARAM_URL
    ));

    $settings->add(new admin_setting_configtext(
        'auth_jwtsso/audience',
        get_string('audience', 'auth_jwtsso'),
        get_string('audience_desc', 'auth_jwtsso'),
        $CFG->wwwroot,
        PARAM_URL
    ));

    $settings->add(new admin_setting_configtext(
        'auth_jwtsso/jwksurl',
        get_string('jwksurl', 'auth_jwtsso'),
        get_string('jwksurl_desc', 'auth_jwtsso'),
        '',
        PARAM_URL
    ));

    $settings->add(new admin_setting_configtextarea(
        'auth_jwtsso/publickey',
        get_string('publickey', 'auth_jwtsso'),
        get_string('publickey_desc', 'auth_jwtsso'),
        ''
    ));

    $settings->add(new admin_setting_configtext(
        'auth_jwtsso/allowedalgs',
        get_string('allowedalgs', 'auth_jwtsso'),
        get_string('allowedalgs_desc', 'auth_jwtsso'),
        'RS256,ES256',
        PARAM_RAW_TRIMMED
    ));

    $settings->add(new admin_setting_configcheckbox(
        'auth_jwtsso/autocreate',
        get_string('autocreate', 'auth_jwtsso'),
        '',
        1
    ));

    $settings->add(new admin_setting_configcheckbox(
        'auth_jwtsso/showbutton',
        get_string('showbutton', 'auth_jwtsso'),
        get_string('showbutton_desc', 'auth_jwtsso'),
        1
    ));

    $settings->add(new admin_setting_configcheckbox(
        'auth_jwtsso/detailedevents',
        get_string('detailedevents', 'auth_jwtsso'),
        get_string('detailedevents_desc', 'auth_jwtsso'),
        0
    ));

    $settings->add(new admin_setting_configduration(
        'auth_jwtsso/noncelifetime',
        get_string('noncelifetime', 'auth_jwtsso'),
        get_string('noncelifetime_desc', 'auth_jwtsso'),
        300
    ));

    $settings->add(new admin_setting_configtext(
        'auth_jwtsso/claim_username',
        get_string('claim_username', 'auth_jwtsso'),
        '',
        'email',
        PARAM_ALPHANUMEXT
    ));

    $settings->add(new admin_setting_configtext(
        'auth_jwtsso/claim_email',
        get_string('claim_email', 'auth_jwtsso'),
        '',
        'email',
        PARAM_ALPHANUMEXT
    ));
}
