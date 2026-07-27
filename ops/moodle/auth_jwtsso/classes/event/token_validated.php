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
 * Event triggered after JWT validation succeeds.
 *
 * @package     auth_jwtsso
 * @category    event
 * @copyright   2025 Christopher Reimann
 * @license     http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

namespace auth_jwtsso\event;

/**
 * Token validated event.
 *
 * Triggered after a JWT has been successfully validated and
 * the claims extracted. Makes the claims available to observers
 * for further processing (e.g. role assignment, attribute sync).
 *
 * @package     auth_jwtsso
 * @category    event
 */
final class token_validated extends \core\event\base {
    /**
     * Initialise event data.
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
     * @return string
     */
    public static function get_name(): string {
        return get_string('event_token_validated', 'auth_jwtsso');
    }

    /**
     * Get human-readable description.
     *
     * @return string
     */
    public function get_description(): string {
        return 'A JWT was successfully validated and its claims were extracted.';
    }

    /**
     * Validate the event data.
     *
     * @return void
     * @throws \coding_exception If required data is missing.
     */
    protected function validate_data(): void {
        parent::validate_data();

        if (empty($this->other['claims']) || !is_array($this->other['claims'])) {
            throw new \coding_exception(
                'Event token_validated must include claims in $other["claims"].'
            );
        }
    }
}
