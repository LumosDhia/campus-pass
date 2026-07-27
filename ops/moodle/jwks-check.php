<?php
// Run inside the Moodle container as daemon (see setup.sh). Proves the plugin can fetch
// the Auth Service JWKS through Moodle's own curl class and resolve a key by kid.
define('CLI_SCRIPT', true);
require('/bitnami/moodle/config.php');
require_once($CFG->libdir . '/filelib.php');

$url = get_config('auth_jwtsso', 'jwksurl');
$cache = \cache::make('auth_jwtsso', 'jwks');
$cache->delete($url);

$c = new \curl();
$body = $c->get($url);
$info = $c->get_info();
$live = json_decode($body, true);
if (empty($live['keys'])) {
    echo "fetch FAIL errno=" . $c->get_errno() . " error=" . $c->error . "\n";
    echo "(\"The URL is blocked.\" means the config.php curlsecurity settings are not in effect)\n";
    exit(1);
}
$kids = array_map(fn($k) => $k['kid'] ?? '?', $live['keys']);
echo "fetch ok " . ($info['http_code'] ?? '?') . " kids=" . implode(',', $kids) . "\n";

$liveKey = null;
foreach ($live['keys'] as $k) {
    if (($k['kid'] ?? '') === 'hub-key-1') {
        $liveKey = $k;
    }
}
if (!$liveKey) {
    echo "kid FAIL hub-key-1 not in live JWKS\n";
    exit(1);
}

// The plugin falls back to the first key of a matching kty. Put a decoy first so only a
// real kid match can return the live key.
$res = openssl_pkey_new(['private_key_bits' => 2048, 'private_key_type' => OPENSSL_KEYTYPE_RSA]);
$d = openssl_pkey_get_details($res)['rsa'];
$b64 = fn($v) => rtrim(strtr(base64_encode($v), '+/', '-_'), '=');
$decoy = ['kty' => 'RSA', 'kid' => 'decoy', 'alg' => 'RS256', 'use' => 'sig', 'n' => $b64($d['n']), 'e' => $b64($d['e'])];
$cache->set($url, json_encode(['keys' => [$decoy, $liveKey]]));

$m = new \ReflectionMethod(\auth_jwtsso\local\validator::class, 'resolve_public_key');
$m->setAccessible(true);
$pem = $m->invoke(null, 'hub-key-1', 'RS256');
$cache->delete($url);

$details = $pem ? openssl_pkey_get_details(openssl_pkey_get_public($pem)) : null;
$n = $details ? $b64($details['rsa']['n']) : null;
if ($n !== $liveKey['n']) {
    echo "kid FAIL resolved key is not the live hub-key-1\n";
    exit(1);
}
echo "kid ok hub-key-1\n";
