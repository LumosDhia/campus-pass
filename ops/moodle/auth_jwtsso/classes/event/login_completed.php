<?php
// This file is part of Moodle - http://moodle.org/.
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
 * Login completed event.
 *
 * @package     auth_jwtsso
 * @category    event
 * @copyright   2025 Christopher Reimann
 * @license     http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

namespace auth_jwtsso\event;

/**
 * Event triggered when a JWT SSO login is successfully completed.
 *
 * @package     auth_jwtsso
 * @category    event
 */
final class login_completed extends \core\event\base {
    /**
     * Initialise the event data.
     *
     * @return void
     */
    protected function init(): void {
        $this->data['crud'] = 'r';
        $this->data['level'] = self::LEVEL_PARTICIPATING;
    }

    /**
     * Get the event name.
     *
     * @return string Localised event name.
     */
    public static function get_name(): string {
        return get_string('event_login_completed', 'auth_jwtsso');
    }

    /**
     * Get the event description.
     *
     * @return string Event description.
     */
    public function get_description(): string {
        return 'The JWT SSO login process was completed successfully.';
    }
}
