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
 * Scheduled task to clean expired nonces.
 *
 * @package     auth_jwtsso
 * @category    task
 * @copyright   2025 Christopher Reimann
 * @license     http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

namespace auth_jwtsso\task;

/**
 * Scheduled task that removes expired JWT SSO nonces.
 *
 * @package     auth_jwtsso
 * @category    task
 */
class cleanup_nonces extends \core\task\scheduled_task {
    /**
     * Get the task name for display in Moodle’s scheduled tasks UI.
     *
     * @return string Localised task name.
     */
    public function get_name(): string {
        return get_string('task_cleanup_nonces', 'auth_jwtsso');
    }

    /**
     * Execute the cleanup operation.
     *
     * Deletes all nonce records that have expired according to their expiry time.
     *
     * @return void
     */
    public function execute(): void {
        global $DB;

        // Remove all expired nonce records.
        $DB->delete_records_select('auth_jwtsso_nonces', 'expires < ?', [time()]);
    }
}
