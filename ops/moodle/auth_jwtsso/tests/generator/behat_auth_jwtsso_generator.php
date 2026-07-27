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
 * Behat data generator for auth_jwtsso.
 *
 * @package    auth_jwtsso
 * @category   test
 * @copyright  2025 Christopher Reimann
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

defined('MOODLE_INTERNAL') || die();

require_once(__DIR__ . '/../../../../lib/behat/classes/behat_generator_base.php');

/**
 * Behat data generator class for the auth_jwtsso plugin.
 *
 * Defines the creatable Behat entities for use in .feature files.
 *
 * Example:
 *   And the following "auth_jwtsso > jwtsso_configs" exist:
 *     | name  | value |
 *     | issuer | https://example.org/idp |
 *
 * @package    auth_jwtsso
 * @category   test
 */
class behat_auth_jwtsso_generator extends behat_generator_base {
    /**
     * Returns a list of entities that Behat can create for this plugin.
     *
     * Each entity maps to a data generator class and defines
     * the required fields that must be provided in the feature file.
     *
     * @return array Array of creatable entities definitions.
     */
    protected function get_creatable_entities(): array {
        return [
            'jwtsso_configs' => [
                'datagenerator' => 'jwtsso_config',
                'required' => ['name', 'value'],
            ],
        ];
    }
}
