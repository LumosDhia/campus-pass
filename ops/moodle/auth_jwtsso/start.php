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
 * SP-initiated start endpoint: creates nonce & redirects to IdP.
 *
 * @package     auth_jwtsso
 * @copyright   2025 Christopher Reimann
 * @license     http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

require(__DIR__ . '/../../config.php');

$issuer = (string)get_config('auth_jwtsso', 'issuer');
if (empty($issuer)) {
    throw new \moodle_exception('Issuer not configured.', 'auth_jwtsso');
}

$nonce = \auth_jwtsso\local\nonce::create();
$aud   = (string)(get_config('auth_jwtsso', 'audience') ?: $CFG->wwwroot);

$params = [
    'nonce'    => $nonce,
    'aud'      => $aud,
    'redirect' => (new moodle_url('/auth/jwtsso/callback.php'))->out(false),
];

$redirect = new moodle_url($issuer, $params);
redirect($redirect);
