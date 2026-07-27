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
 * JWKS cache helper.
 *
 * @package     auth_jwtsso
 * @copyright   2025 Christopher Reimann
 * @license     http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

namespace auth_jwtsso\local;

defined('MOODLE_INTERNAL') || die();

require_once($CFG->libdir . '/filelib.php'); // Required for curl class.

/**
 * JWKS fetch + cache.
 */
final class jwks_cache {
    /**
     * Get JWKS as array, cached by URL.
     *
     * @param string $jwksurl
     * @return array|null
     */
    public static function get(string $jwksurl): ?array {
        $cache = \cache::make('auth_jwtsso', 'jwks');
        if ($json = $cache->get($jwksurl)) {
            $data = json_decode($json, true);
            return is_array($data) ? $data : null;
        }

        $client = new \curl();
        $client->setHeader(['Accept: application/json']);
        $resp = $client->get($jwksurl);
        $data = json_decode($resp, true);
        if (!is_array($data) || empty($data['keys'])) {
            return null;
        }

        $cache->set($jwksurl, json_encode($data));
        return $data;
    }
}
