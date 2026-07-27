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
 * Event triggered when a new user is provisioned via JWT SSO.
 *
 * @package     auth_jwtsso
 * @category    event
 * @copyright   2025 Christopher Reimann
 * @license     http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

namespace auth_jwtsso\event;

/**
 * User provisioned event.
 *
 * Triggered when a new Moodle user account is automatically
 * created from a validated JWT. Includes the original claims
 * for downstream processing by observers.
 *
 * @package     auth_jwtsso
 * @category    event
 */
final class user_provisioned extends \core\event\base {
    /**
     * Initialise event data.
     *
     * @return void
     */
    protected function init(): void {
        $this->data['crud'] = 'c';
        $this->data['level'] = self::LEVEL_PARTICIPATING;
    }

    /**
     * Get the event name.
     *
     * @return string
     */
    public static function get_name(): string {
        return get_string('event_user_provisioned', 'auth_jwtsso');
    }

    /**
     * Get human-readable description.
     *
     * @return string
     */
    public function get_description(): string {
        return "A new user was provisioned via JWT SSO (user ID {$this->relateduserid}).";
    }

    /**
     * Validate the event data.
     *
     * @return void
     * @throws \coding_exception If required data is missing.
     */
    protected function validate_data(): void {
        parent::validate_data();

        if (empty($this->relateduserid)) {
            throw new \coding_exception(
                'Event user_provisioned must define $relateduserid.'
            );
        }

        if (empty($this->other['claims']) || !is_array($this->other['claims'])) {
            throw new \coding_exception(
                'Event user_provisioned must include claims in $other["claims"].'
            );
        }
    }
}
