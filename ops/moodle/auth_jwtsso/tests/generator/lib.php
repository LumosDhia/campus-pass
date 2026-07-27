<?php
// This file is part of Moodle - https://moodle.org/
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
// along with Moodle.  If not, see <https://www.gnu.org/licenses/>.

/**
 * Data generator for auth_jwtsso plugin.
 *
 * @package    auth_jwtsso
 * @category   test
 * @copyright   2025 Christopher Reimann
 * @license     http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class auth_jwtsso_generator extends component_generator_base {
    /**
     * Create a JWT SSO config value.
     *
     * @param array $record
     * @return void
     */
    public function create_jwtsso_config(array $record): void {
        if (empty($record['name']) || !array_key_exists('value', $record)) {
            throw new coding_exception('Missing required fields for jwtsso_config');
        }
        set_config($record['name'], $record['value'], 'auth_jwtsso');
    }
}
