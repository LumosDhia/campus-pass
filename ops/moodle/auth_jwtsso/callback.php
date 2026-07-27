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
 * Callback endpoint receiving JWT and completing login.
 *
 * @package     auth_jwtsso
 * @copyright   2025 Christopher Reimann
 * @license     http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

require(__DIR__ . '/../../config.php');
require_once($CFG->dirroot . '/user/lib.php');


$token = required_param('token', PARAM_RAW_TRIMMED);

$context = context_system::instance();

// Log early (no sensitive token content).
if (!empty(get_config('auth_jwtsso', 'detailedevents'))) {
    \auth_jwtsso\event\token_received::create([
        'context' => $context,
        'other' => ['has_token' => true, 'len' => strlen($token)],
    ])->trigger();
}

try {
    $claims = \auth_jwtsso\local\validator::validate($token);

    $emailclaim = get_config('auth_jwtsso', 'claim_email') ?: 'email';
    $userclaim  = get_config('auth_jwtsso', 'claim_username') ?: $emailclaim;

    $email = core_text::strtolower(trim((string)($claims[$emailclaim] ?? '')));
    $username = core_text::strtolower(trim((string)($claims[$userclaim] ?? $email)));

    if (empty($email)) {
        throw new moodle_exception('missingemail', 'auth_jwtsso');
    }

    // Fire token_validated as soon as the claims are verified.
    if (!empty(get_config('auth_jwtsso', 'detailedevents'))) {
        \auth_jwtsso\event\token_validated::create([
            'context' => $context,
            'other' => ['claims' => $claims],
        ])->trigger();
    }

    global $DB, $CFG;

    if (!$user = $DB->get_record('user', ['email' => $email, 'deleted' => 0])) {
        if (!empty(get_config('auth_jwtsso', 'autocreate'))) {
            $u = new stdClass();
            $u->auth       = 'jwtsso';
            $u->username   = $username;
            $u->email      = $email;
            $u->firstname  = (string)($claims['given_name'] ?? '');
            $u->lastname   = (string)($claims['family_name'] ?? ($claims['name'] ?? ''));
            $u->confirmed  = 1;
            $u->mnethostid = $CFG->mnet_localhost_id;

            $userid = user_create_user($u, false, false);
            $user = core_user::get_user($userid, '*', MUST_EXIST);

            if (!empty(get_config('auth_jwtsso', 'detailedevents'))) {
                \auth_jwtsso\event\user_provisioned::create([
                    'context' => $context,
                    'relateduserid' => $user->id,
                    'other' => [
                        'claims' => $claims,
                    ],
                ])->trigger();
            }
        } else {
            throw new moodle_exception('usernotfound', 'auth_jwtsso', '', $email);
        }
    }

    complete_user_login($user);
    \core\session\manager::write_close(); // Ensure session is committed before redirect.

    if (!empty(get_config('auth_jwtsso', 'detailedevents'))) {
        \auth_jwtsso\event\login_completed::create([
            'context' => $context,
            'relateduserid' => $user->id,
        ])->trigger();
    }

    redirect(new moodle_url('/'));
} catch (Throwable $e) {
    \core\notification::error('SSO failed: ' . $e->getMessage());

    if (!empty(get_config('auth_jwtsso', 'detailedevents'))) {
        \auth_jwtsso\event\login_failed::create([
            'context' => $context,
            'other' => ['message' => $e->getMessage()],
        ])->trigger();
    }
    \core\notification::error(get_string('err_login_failed', 'auth_jwtsso'));
    redirect(new moodle_url('/login/index.php'));
}
