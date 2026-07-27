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
 * Behat step definitions for JWT SSO plugin.
 *
 * @package   auth_jwtsso
 * @category  test
 * @copyright 2025 Christopher Reimann
 * @license   http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

// .⚠️ No MOODLE_INTERNAL check — required for Behat.
require_once(__DIR__ . '/../../../../lib/behat/behat_base.php');

/**
 * Step definitions for auth_jwtsso plugin.
 */
class behat_auth_jwtsso extends behat_base {
    /**
     * Sets the plugin's public key from a PEM fixture file.
     *
     * @Given /^I set JWTS SSO public key from fixture "(?P<fixture>[^"]*)"$/
     * @param string $fixture Relative path from dirroot.
     */
    public function i_set_jwtsso_public_key_from_fixture(string $fixture): void {
        global $CFG;
        $fullpath = $CFG->dirroot . '/' . $fixture;

        if (!is_readable($fullpath)) {
            throw new Exception("Fixture not found or unreadable: {$fullpath}");
        }

        $pem = file_get_contents($fullpath);
        set_config('publickey', $pem, 'auth_jwtsso');
    }

    /**
     * Generates a valid JWT for a given user email, stores it temporarily,
     * and inserts the corresponding nonce record in the test DB.
     *
     * @Given /^I have a fresh JWTS SSO token for "(?P<email>[^"]*)"$/
     * @param string $email User email claim.
     */
    public function i_have_a_fresh_jwtsso_token_for(string $email): void {
        global $CFG, $DB;

        $privatekeyfile = $CFG->dirroot . '/auth/jwtsso/tests/fixtures/private.pem';
        if (!is_readable($privatekeyfile)) {
            throw new \Exception("Private key missing: {$privatekeyfile}");
        }

        $privatekey = file_get_contents($privatekeyfile);
        $now = time();

        // Generate unique nonce.
        $nonce = 'behatnonce' . random_int(1000, 9999);

        $claims = [
            'iss' => 'https://reimann-dev.ddns.net/test-idp',
            'aud' => 'https://reimann-dev.ddns.net/',
            'iat' => $now,
            'exp' => $now + 600, // Valid for 10 minutes.
            'nonce' => $nonce,
            'email' => $email,
            'given_name' => 'Behat',
            'family_name' => 'User',
        ];

        // Create the signed JWT.
        require_once($CFG->libdir . '/filelib.php');
        if (!class_exists('\Firebase\JWT\JWT')) {
            throw new \Exception('Missing Firebase\JWT library.');
        }

        $token = \Firebase\JWT\JWT::encode($claims, $privatekey, 'RS256');

        // Store it in plugin config so other steps can access it.
        set_config('currentbehatjwt', $token, 'auth_jwtsso');

        // /.✅ Insert the nonce into the plugin’s table so validator finds it.
        $record = (object)[
            'nonce' => $nonce,
            'jti' => '',
            'timecreated' => $now,
            'expires' => $now + 600,
            'used' => 0,
        ];
        $DB->insert_record('auth_jwtsso_nonces', $record);

        // Optional: Behat debug echo to confirm nonce/token created.
        if (defined('BEHAT_SITE_RUNNING')) {
            echo "✅ Inserted nonce {$nonce} and stored current JWT.\n";
        }
    }

    /**
     * Visits the callback URL with the last generated token.
     *
     * @When /^I visit the JWTS SSO callback with the current token$/
     */
    public function i_visit_the_jwtsso_callback_with_the_current_token(): void {
        global $CFG;

        $token = get_config('auth_jwtsso', 'currentbehatjwt');
        if (empty($token)) {
            throw new Exception('No JWT token found. Did you call "I have a fresh JWTS SSO token for ..." first?');
        }

        $url = new moodle_url('/auth/jwtsso/callback.php', ['token' => $token]);
        $this->getSession()->visit($url->out(false));

        // Cleanup for test isolation.
        set_config('currentbehatjwt', null, 'auth_jwtsso');
    }
}
