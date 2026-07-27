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
 * Nonce and jti management utilities.
 *
 * @package     auth_jwtsso
 * @copyright   2025 Christopher Reimann
 * @license     http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

namespace auth_jwtsso\local;

/**
 * Nonce store/helper.
 */
final class nonce {
    /**
     * Create a nonce and persist it.
     *
     * @return string
     */
    public static function create(): string {
        global $DB;

        $lifetime = (int) get_config('auth_jwtsso', 'noncelifetime') ?: 300;
        $value = bin2hex(random_bytes(16));

        $rec = (object) [
            'nonce'       => $value,
            'jti'         => null,
            'timecreated' => time(),
            'expires'     => time() + $lifetime,
            'used'        => 0,
        ];
        $DB->insert_record('auth_jwtsso_nonces', $rec);

        if (self::detailedevents()) {
            \auth_jwtsso\event\nonce_created::create([
                'context' => \context_system::instance(),
                'other' => ['nonce' => $value, 'expires' => $rec->expires],
            ])->trigger();
        }

        return $value;
    }

    /**
     * Consume a nonce (and record jti).
     *
     * @param string $value
     * @param string|null $jti
     * @return void
     */
    public static function consume(string $value, ?string $jti): void {
        global $DB;

        $rec = $DB->get_record('auth_jwtsso_nonces', ['nonce' => $value], '*', IGNORE_MISSING);
        if (!$rec || $rec->used || $rec->expires < time()) {
            throw new \moodle_exception('invalidnonce', 'auth_jwtsso');
        }

        $rec->used = 1;
        if ($jti && empty($rec->jti)) {
            $rec->jti = $jti;
        }
        $DB->update_record('auth_jwtsso_nonces', $rec);
    }

    /**
     * Check flag for detailed events.
     *
     * @return bool
     */
    private static function detailedevents(): bool {
        return !empty(get_config('auth_jwtsso', 'detailedevents'));
    }
}
