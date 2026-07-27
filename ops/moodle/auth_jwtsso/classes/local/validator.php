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
 * JWT validator (RS/ES) with JWKS or PEM resolution.
 *
 * @package     auth_jwtsso
 * @copyright   2025 Christopher Reimann
 * @license     http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

namespace auth_jwtsso\local;

/**
 * Validate JWT and return claims.
 */
final class validator {
    /**
     * Validate and return claims.
     *
     * @param string $jwt
     * @return array
     */
    public static function validate(string $jwt): array {
        global $CFG, $DB;

        $config = get_config('auth_jwtsso');
        $allowedalgs = array_map('trim', explode(',', (string)($config->allowedalgs ?? 'RS256,ES256')));

        [$h64, $p64, $s64] = array_pad(explode('.', $jwt), 3, null);
        if (!$h64 || !$p64 || !$s64) {
            throw new \moodle_exception('invalidjwt', 'auth_jwtsso');
        }

        $header = json_decode(self::b64u_decode($h64), true) ?: [];
        $claims = json_decode(self::b64u_decode($p64), true) ?: [];
        $sig    = self::b64u_decode($s64);

        $alg = (string)($header['alg'] ?? '');
        $kid = $header['kid'] ?? null;

        if (!in_array($alg, $allowedalgs, true)) {
            throw new \moodle_exception('invalidalg', 'auth_jwtsso', '', $alg);
        }

        $pem = self::resolve_public_key($kid, $alg);
        if (!$pem) {
            throw new \moodle_exception('missingkey', 'auth_jwtsso');
        }

        $signed = $h64 . '.' . $p64;
        if (!self::verify_signature($signed, $sig, $pem, $alg)) {
            throw new \moodle_exception('badsignature', 'auth_jwtsso');
        }

        $now = time();
        $skew = 300;

        $iss   = (string)($claims['iss'] ?? '');
        $aud   = (string)($claims['aud'] ?? '');
        $exp   = (int)($claims['exp'] ?? 0);
        $iat   = (int)($claims['iat'] ?? 0);
        $nonce = $claims['nonce'] ?? null;
        $jti   = $claims['jti'] ?? null;

        if (empty($iss) || empty($aud) || empty($exp)) {
            throw new \moodle_exception('missingclaims', 'auth_jwtsso');
        }

        if (!empty($config->issuer) && $iss !== $config->issuer) {
            throw new \moodle_exception('badissuer', 'auth_jwtsso', '', $iss);
        }

        $expectaud = trim((string)($config->audience ?: $CFG->wwwroot));
        if ($aud !== $expectaud) {
            throw new \moodle_exception('badaudience', 'auth_jwtsso', '', $aud);
        }

        if ($exp < ($now - $skew) || ($iat && $iat > ($now + $skew))) {
            throw new \moodle_exception('badtime', 'auth_jwtsso');
        }

        if (empty($nonce)) {
            throw new \moodle_exception('missingnonce', 'auth_jwtsso');
        }

        // Enforce nonce DB usage + replay protection.
        $noncerec = $DB->get_record('auth_jwtsso_nonces', ['nonce' => $nonce], '*', IGNORE_MISSING);
        if (!$noncerec) {
            throw new \moodle_exception('badnonce', 'auth_jwtsso');
        }
        if (!empty($noncerec->used)) {
            throw new \moodle_exception('noncereplay', 'auth_jwtsso');
        }
        if (!empty($noncerec->expires) && $noncerec->expires < time()) {
            throw new \moodle_exception('badnonce', 'auth_jwtsso');
        }
        // Mark as used now to prevent replay.
        $DB->set_field('auth_jwtsso_nonces', 'used', 1, ['id' => $noncerec->id]);

        // Require email (your callback also relies on it).
        if (empty($claims['email'])) {
            throw new \moodle_exception('missingemail', 'auth_jwtsso');
        }

        return $claims;
    }

    /**
     * Resolve PEM via JWKS (kid) or manual PEM.
     *
     * @param string|null $kid
     * @param string $alg
     * @return string|null
     */
    private static function resolve_public_key(?string $kid, string $alg): ?string {
        $config = get_config('auth_jwtsso');

        if (!empty($config->jwksurl)) {
            $jwks = jwks_cache::get($config->jwksurl);
            if ($jwks && !empty($jwks['keys'])) {
                if ($kid) {
                    foreach ($jwks['keys'] as $jwk) {
                        if (isset($jwk['kid']) && $jwk['kid'] === $kid) {
                            return self::jwk_to_pem($jwk);
                        }
                    }
                    // If the kid is not found in the cached JWKS,
                    // invalidate the cache and repeat once.
                    $cache = \cache::make('auth_jwtsso', 'jwks');
                    $cache->delete($config->jwksurl);
                    $jwks = jwks_cache::get($config->jwksurl);
                    if ($jwks && !empty($jwks['keys'])) {
                        foreach ($jwks['keys'] as $jwk) {
                            if (isset($jwk['kid']) && $jwk['kid'] === $kid) {
                                return self::jwk_to_pem($jwk);
                            }
                        }
                    }
                }
                foreach ($jwks['keys'] as $jwk) {
                    if (self::alg_matches_kty($alg, (string)($jwk['kty'] ?? ''))) {
                        return self::jwk_to_pem($jwk);
                    }
                }
            }
        }

        $pem = (string)($config->publickey ?? '');
        return trim($pem) !== '' ? $pem : null;
    }

    /**
     * Verify signature (RS/ES).
     *
     * @param string $signed
     * @param string $sig
     * @param string $pem
     * @param string $alg
     * @return bool
     */
    private static function verify_signature(string $signed, string $sig, string $pem, string $alg): bool {
        if (str_starts_with($alg, 'RS')) {
            $hash = 'sha' . substr($alg, 2);
            return openssl_verify($signed, $sig, $pem, $hash) === 1;
        }
        if (str_starts_with($alg, 'ES')) {
            $hash = 'sha' . substr($alg, 2);
            $der  = self::ecdsa_jose_to_der($sig);
            return openssl_verify($signed, $der, $pem, $hash) === 1;
        }
        return false;
    }

    /**
     * Base64url decode.
     *
     * @param string $b64u
     * @return string
     */
    private static function b64u_decode(string $b64u): string {
        $b64 = strtr($b64u, '-_', '+/');
        return base64_decode($b64 . str_repeat('=', (4 - strlen($b64) % 4) % 4));
    }

    /**
     * Convert JWK (RSA/EC) to PEM.
     *
     * @param array $jwk
     * @return string|null
     */
    private static function jwk_to_pem(array $jwk): ?string {
        $kty = $jwk['kty'] ?? '';
        if ($kty === 'RSA' && !empty($jwk['n']) && !empty($jwk['e'])) {
            $n = self::b64u_decode($jwk['n']);
            $e = self::b64u_decode($jwk['e']);
            $seq = self::asn1_sequence(self::asn1_integer($n) . self::asn1_integer($e));
            $der = self::asn1_sequence(
                self::asn1_sequence(self::asn1_object_identifier("\x2A\x86\x48\x86\xF7\x0D\x01\x01\x01") . self::asn1_null()) .
                self::asn1_bit_string("\x00" . $seq)
            );
            $pem = "-----BEGIN PUBLIC KEY-----\n" .
                chunk_split(base64_encode($der), 64, "\n") .
                "-----END PUBLIC KEY-----\n";
            return $pem;
        }
        // EC P-256 (ES256) support.
        if ($kty === 'EC' && !empty($jwk['crv']) && !empty($jwk['x']) && !empty($jwk['y'])) {
            $crv = $jwk['crv'];
            if ($crv === 'P-256') {
                $x = self::b64u_decode($jwk['x']);
                $y = self::b64u_decode($jwk['y']);
                // EC public key point: 0x04 (uncompressed) + x + y.
                $point = "\x04" . $x . $y;
                // OID for secp256r1 (P-256): 1.2.840.10045.3.1.7.
                $oid = "\x2A\x86\x48\xCE\x3D\x03\x01\x07";
                $der = self::asn1_sequence(
                    self::asn1_sequence(
                        self::asn1_object_identifier("\x2A\x86\x48\xCE\x3D\x02\x01") .
                        self::asn1_object_identifier($oid)
                    ) .
                    self::asn1_bit_string("\x00" . $point)
                );
                $pem = "-----BEGIN PUBLIC KEY-----\n" .
                    chunk_split(base64_encode($der), 64, "\n") .
                    "-----END PUBLIC KEY-----\n";
                return $pem;
            }
        }
        return null;
    }

    /**
     * ASN.1 helpers for RSA SPKI.
     *
     * These functions are used to build minimal DER sequences for RSA public key encoding.
     * They are intentionally private and static, but require docblocks for codechecker compliance.
     */

    /**
     * Encode an ASN.1 length field.
     *
     * @param int $len The length to encode.
     * @return string Binary length field.
     */
    private static function asn1_length(int $len): string {
        if ($len <= 0x7F) {
            return chr($len);
        }
        $bin = ltrim(pack('N', $len), "\x00");
        return chr(0x80 | strlen($bin)) . $bin;
    }

    /**
     * Encode an ASN.1 INTEGER value.
     *
     * @param string $i Binary integer data.
     * @return string ASN.1 INTEGER element.
     */
    private static function asn1_integer(string $i): string {
        if ($i === '' || (ord($i[0]) & 0x80)) {
            $i = "\x00" . $i;
        }
        return "\x02" . self::asn1_length(strlen($i)) . $i;
    }

    /**
     * Encode an ASN.1 SEQUENCE containing the given data.
     *
     * @param string $data Concatenated ASN.1 elements.
     * @return string ASN.1 SEQUENCE element.
     */
    private static function asn1_sequence(string $data): string {
        return "\x30" . self::asn1_length(strlen($data)) . $data;
    }

    /**
     * Encode an ASN.1 NULL element.
     *
     * @return string ASN.1 NULL element.
     */
    private static function asn1_null(): string {
        return "\x05\x00";
    }

    /**
     * Encode an ASN.1 BIT STRING element.
     *
     * @param string $data The bit string content (already includes unused-bits indicator if needed).
     * @return string ASN.1 BIT STRING element.
     */
    private static function asn1_bit_string(string $data): string {
        return "\x03" . self::asn1_length(strlen($data)) . $data;
    }

    /**
     * Encode an ASN.1 OBJECT IDENTIFIER element.
     *
     * @param string $oid The binary object identifier.
     * @return string ASN.1 OBJECT IDENTIFIER element.
     */
    private static function asn1_object_identifier(string $oid): string {
        return "\x06" . self::asn1_length(strlen($oid)) . $oid;
    }

    /**
     * Convert JOSE ECDSA (r||s) to DER sequence.
     *
     * @param string $sig
     * @return string
     */
    private static function ecdsa_jose_to_der(string $sig): string {
        $len = (int)(strlen($sig) / 2);
        $r = ltrim(substr($sig, 0, $len), "\x00");
        $s = ltrim(substr($sig, $len), "\x00");
        $r = (ord($r[0] ?? "\x00") > 0x7F) ? ("\x00" . $r) : $r;
        $s = (ord($s[0] ?? "\x00") > 0x7F) ? ("\x00" . $s) : $s;
        $seq = "\x02" . self::asn1_length(strlen($r)) . $r .
               "\x02" . self::asn1_length(strlen($s)) . $s;
        return "\x30" . self::asn1_length(strlen($seq)) . $seq;
    }

    /**
     * Match JWT alg to JWK kty.
     *
     * @param string $alg
     * @param string $kty
     * @return bool
     */
    private static function alg_matches_kty(string $alg, string $kty): bool {
        return (str_starts_with($alg, 'RS') && $kty === 'RSA') ||
               (str_starts_with($alg, 'ES') && $kty === 'EC');
    }
}
