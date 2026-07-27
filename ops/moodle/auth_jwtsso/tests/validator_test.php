<?php
// This file is part of Moodle - https://moodle.org/.
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
 * PHPUnit tests for auth_jwtsso validator.
 *
 * @package    auth_jwtsso
 * @category   test
 * @copyright  2025 Christopher Reimann
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

namespace auth_jwtsso\tests;

use advanced_testcase;
use auth_jwtsso\local\validator;

/**
 * Unit tests for JWT validation in the auth_jwtsso plugin.
 *
 * @coversDefaultClass \auth_jwtsso\local\validator
 */
final class validator_test extends advanced_testcase {
    /** @var string PEM private key generated for tests. */
    private string $privatekey = '';

    /** @var string PEM public key generated for tests. */
    private string $publickey = '';

    /**
     * Prepare a fresh keypair and reset plugin configuration.
     */
    protected function setUp(): void {
        parent::setUp();
        $this->resetAfterTest();

        // Create a temporary RSA keypair.
        $res = openssl_pkey_new(['private_key_bits' => 2048]);
        $details = openssl_pkey_get_details($res);
        $this->publickey = $details['key'];
        openssl_pkey_export($res, $this->privatekey);

        // Plugin configuration setup.
        set_config('issuer', 'https://idp.test.local', 'auth_jwtsso');
        set_config('audience', 'https://moodle.test/', 'auth_jwtsso');
        set_config('publickey', $this->publickey, 'auth_jwtsso');
        set_config('allowedalgs', 'RS256', 'auth_jwtsso');
    }

    /**
     * Helper to create a signed JWT with the current private key.
     *
     * @param array $claims The claims to include in the token.
     * @return string The encoded JWT string.
     */
    private function make_jwt(array $claims): string {
        $header = ['alg' => 'RS256', 'typ' => 'JWT'];
        $segments = [
            rtrim(strtr(base64_encode(json_encode($header)), '+/', '-_'), '='),
            rtrim(strtr(base64_encode(json_encode($claims)), '+/', '-_'), '='),
        ];
        $signinput = implode('.', $segments);
        openssl_sign($signinput, $signature, $this->privatekey, OPENSSL_ALGO_SHA256);
        $segments[] = rtrim(strtr(base64_encode($signature), '+/', '-_'), '=');
        return implode('.', $segments);
    }

    /**
     * Inserts a dummy nonce record into the auth_jwtsso_nonces table.
     *
     * @param string $nonce The nonce value to insert.
     */
    private function insert_nonce(string $nonce): void {
        global $DB;
        $rec = (object)[
            'nonce' => $nonce,
            'jti' => '',
            'timecreated' => time(),
            'expires' => time() + 300,
            'used' => 0,
        ];
        $DB->insert_record('auth_jwtsso_nonces', $rec);
    }

    // -------------------------------------------------------------------------
    // .✅ VALID CASES
    // -------------------------------------------------------------------------

    /**
     * Ensure that a valid JWT passes validation and returns expected claims.
     *
     * @covers ::validate
     */
    public function test_valid_jwt_signature_and_claims(): void {
        $now = time();
        $claims = [
            'iss'   => 'https://idp.test.local',
            'aud'   => 'https://moodle.test/',
            'iat'   => $now,
            'exp'   => $now + 120,
            'nonce' => 'unit-nonce-ok',
            'email' => 'user@example.com',
        ];
        $token = $this->make_jwt($claims);
        $this->insert_nonce($claims['nonce']);

        $result = validator::validate($token);

        $this->assertIsArray($result);
        $this->assertEquals($claims['email'], $result['email']);
        $this->assertEquals($claims['aud'], $result['aud']);
    }

    // -------------------------------------------------------------------------
    // .❌ INVALID CASES
    // -------------------------------------------------------------------------

    /**
     * Ensure that an invalid audience triggers a moodle_exception.
     *
     * @covers ::validate
     */
    public function test_invalid_audience(): void {
        $this->expectException(\moodle_exception::class);
        $this->expectExceptionMessageMatches('/audience/i');

        $now = time();
        $claims = [
            'iss'   => 'https://idp.test.local',
            'aud'   => 'https://wrong-aud.local/',
            'iat'   => $now,
            'exp'   => $now + 120,
            'nonce' => 'unit-nonce-wrong',
            'email' => 'user@example.com',
        ];
        $token = $this->make_jwt($claims);
        $this->insert_nonce($claims['nonce']);

        validator::validate($token);
    }

    /**
     * Ensure that an invalid issuer triggers a moodle_exception.
     *
     * @covers ::validate
     */
    public function test_invalid_issuer(): void {
        $this->expectException(\moodle_exception::class);
        $this->expectExceptionMessageMatches('/issuer/i');

        $now = time();
        $claims = [
            'iss'   => 'https://evil-idp.test.local',
            'aud'   => 'https://moodle.test/',
            'iat'   => $now,
            'exp'   => $now + 120,
            'nonce' => 'unit-nonce-evil',
            'email' => 'user@example.com',
        ];
        $token = $this->make_jwt($claims);
        $this->insert_nonce($claims['nonce']);

        validator::validate($token);
    }

    /**
     * Ensure that an expired token is rejected (beyond skew).
     *
     * @covers ::validate
     */
    public function test_expired_token_rejected(): void {
        $this->expectException(\moodle_exception::class);
        $this->expectExceptionMessageMatches('/expired|badtime/i');

        $now = time();
        $claims = [
            'iss'   => 'https://idp.test.local',
            'aud'   => 'https://moodle.test/',
            'iat'   => $now - 1200, // Issued 20 min ago.
            'exp'   => $now - 1000, // Expired well beyond 300s skew.
            'nonce' => 'unit-nonce-expired',
            'email' => 'user@example.com',
        ];
        $token = $this->make_jwt($claims);
        $this->insert_nonce($claims['nonce']);

        validator::validate($token);
    }

    /**
     * Ensure that a replayed nonce is rejected if reused.
     *
     * @covers ::validate
     */
    public function test_replayed_nonce_rejected(): void {
        $now = time();
        $claims = [
            'iss'   => 'https://idp.test.local',
            'aud'   => 'https://moodle.test/',
            'iat'   => $now,
            'exp'   => $now + 120,
            'nonce' => 'unit-nonce-replay',
            'email' => 'user@example.com',
        ];
        $token = $this->make_jwt($claims);
        $this->insert_nonce($claims['nonce']);

        // First validation should pass and mark nonce as used.
        $ok = validator::validate($token);
        $this->assertEquals('user@example.com', $ok['email']);

        // Second validation must fail due to replay.
        $this->expectException(\moodle_exception::class);
        $this->expectExceptionMessageMatches('/nonce|replay/i');
        validator::validate($token);
    }

    /**
     * Ensure that a missing email claim triggers a moodle_exception.
     *
     * @covers ::validate
     */
    public function test_missing_email_claim_fails(): void {
        $this->expectException(\moodle_exception::class);
        $this->expectExceptionMessageMatches('/email/i');

        $now = time();
        $claims = [
            'iss'   => 'https://idp.test.local',
            'aud'   => 'https://moodle.test/',
            'iat'   => $now,
            'exp'   => $now + 120,
            'nonce' => 'unit-nonce-noemail',
            // email intentionally omitted.
        ];
        $token = $this->make_jwt($claims);
        $this->insert_nonce($claims['nonce']);

        validator::validate($token);
    }

    /**
     * Ensure that a token with a tampered signature is rejected.
     *
     * @covers ::validate
     */
    public function test_tampered_signature_rejected(): void {
        $this->expectException(\moodle_exception::class);
        $this->expectExceptionMessageMatches('/signature|badsignature/i');

        $now = time();
        $claims = [
            'iss'   => 'https://idp.test.local',
            'aud'   => 'https://moodle.test/',
            'iat'   => $now,
            'exp'   => $now + 120,
            'nonce' => 'unit-nonce-tampered',
            'email' => 'user@example.com',
        ];
        $token = $this->make_jwt($claims);

        // Flip a character in the SIGNATURE segment only.
        $parts = explode('.', $token);
        $sig = $parts[2];
        $pos = max(0, (int)floor(strlen($sig) / 2));
        $sig[$pos] = ($sig[$pos] === 'A') ? 'B' : 'A';
        $tampered = $parts[0] . '.' . $parts[1] . '.' . $sig;

        $this->insert_nonce($claims['nonce']);
        validator::validate($tampered);
    }
}
