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
 * Authentication plugin for JWT-based SSO.
 *
 * @package     auth_jwtsso
 * @copyright   2025 Christopher Reimann
 * @license     http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

require_once($CFG->libdir . '/authlib.php');

/**
 * JWT SSO auth plugin.
 *
 * @package     auth_jwtsso
 */
class auth_plugin_jwtsso extends auth_plugin_base {
    /**
     * Constructor.
     */
    public function __construct() {
        $this->authtype = 'jwtsso';
        $this->config = get_config('auth_jwtsso');
    }

    /**
     * External login only.
     *
     * @param string $username
     * @param string $password
     * @return bool
     */
    public function user_login($username, $password) {
        return false;
    }

    /**
     * No internal passwords.
     *
     * @return bool
     */
    public function is_internal(): bool {
        return false;
    }

    /**
     * Prevent local password changes.
     *
     * @return bool
     */
    public function can_change_password(): bool {
        return false;
    }

    /**
     * Avoid local password usage.
     *
     * @return bool
     */
    public function prevent_local_passwords(): bool {
        return true;
    }

    /**
     * Inject a login button for SP-initiated flow when enabled.
     *
     * @return void
     */
    public function loginpage_hook(): void {
        global $PAGE;

        if (empty($this->config->showbutton)) {
            return;
        }

        $url = new moodle_url('/auth/jwtsso/start.php');
        $button = html_writer::link(
            $url,
            get_string('loginbutton', 'auth_jwtsso'),
            ['class' => 'btn btn-primary w-100 my-2']
        );

        // Lightweight injection to the core login card.
        $PAGE->requires->js_init_code(
            "document.addEventListener('DOMContentLoaded',function(){" .
            "var c=document.querySelector('.loginpanel .card-body, .loginform');" .
            "if(c){var d=document.createElement('div');" .
            "d.innerHTML=" . json_encode($button) . ";c.appendChild(d);}});"
        );
    }
}
