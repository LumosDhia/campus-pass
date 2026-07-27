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
 * Nonce created event.
 *
 * @package     auth_jwtsso
 * @category    event
 * @copyright   2025 Christopher Reimann
 * @license     http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

namespace auth_jwtsso\event;

/**
 * Event triggered when a nonce is created for JWT SSO.
 *
 * @package     auth_jwtsso
 * @category    event
 */
final class nonce_created extends \core\event\base {
    /**
     * Initialise the event data.
     *
     * Sets CRUD and level for this event.
     *
     * @return void
     */
    protected function init(): void {
        $this->data['crud'] = 'c';
        $this->data['level'] = self::LEVEL_OTHER;
    }

    /**
     * Get the event name.
     *
     * Returns the localised event name string.
     *
     * @return string Localised event name.
     */
    public static function get_name(): string {
        return get_string('event_nonce_created', 'auth_jwtsso');
    }

    /**
     * Get a description of what happened.
     *
     * Provides a human-readable description for the logs.
     *
     * @return string Event description.
     */
    public function get_description(): string {
        return 'A new nonce was generated for JWT SSO authentication.';
    }
}
