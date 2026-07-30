#!/usr/bin/env bash
# Walks the real resolver -> Auth Service -> Moodle hops for a freshly
# enrolled student. Needs the full stack up and `bash ops/moodle/setup.sh`
# already run. Every run mints a new serial and leaves it in place.
set -euo pipefail

: "${REGISTRAR_USERNAME:?set REGISTRAR_USERNAME}"
: "${REGISTRAR_PASSWORD:?set REGISTRAR_PASSWORD}"

PORTAL=${PORTAL_URL:-http://localhost:3002}
ORCH=${ORCHESTRATOR_URL:-http://localhost:4002}
RESOLVER=${RESOLVER_URL:-http://localhost:8090}
GATEWAY=${IPFS_GATEWAY_URL:-http://localhost:8081}
AS=http://localhost:4001
MOODLE=http://localhost:8092
GTIN=09521234500001
SERIAL="E2E-$(date +%s)"
EMAIL="$(echo "$SERIAL" | tr 'A-Z' 'a-z')@students.nordicpoly.local"

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
PORTAL_JAR=$WORK/portal.jar
SSO_JAR=$WORK/sso.jar

fail() { echo "FAIL: $*"; exit 1; }
step() { echo "== $*"; }

# hop <jar> <url> -> sets HOP_CODE and HOP_URL (the redirect target, if any)
hop() {
  local out
  out=$(curl -s -b "$1" -c "$1" -o /dev/null -w '%{http_code} %{redirect_url}' "$2")
  HOP_CODE=${out%% *}
  HOP_URL=${out#* }
  echo "   $HOP_CODE $2 -> ${HOP_URL:-(none)}"
}

expect() { # <label> <code-regex> <url-prefix>
  [[ $HOP_CODE =~ $2 ]] || fail "$1: expected status $2, got $HOP_CODE"
  [[ $HOP_URL == "$3"* ]] || fail "$1: expected redirect to $3..., got ${HOP_URL:-(none)}"
}

step "portal login and mint $SERIAL"
code=$(curl -s -c "$PORTAL_JAR" -o /dev/null -w '%{http_code}' -XPOST "$PORTAL/api/login" \
  -H content-type:application/json \
  -d "{\"username\":\"$REGISTRAR_USERNAME\",\"password\":\"$REGISTRAR_PASSWORD\"}")
[[ $code == 204 ]] || fail "portal login returned $code"

WALLET="0x$(openssl rand -hex 20)"
mint=$(curl -s -b "$PORTAL_JAR" -w '\n%{http_code}' -XPOST "$PORTAL/api/orchestrator/mint" \
  -H content-type:application/json \
  -d "{\"gtin\":\"$GTIN\",\"serial\":\"$SERIAL\",\"ownerAddress\":\"$WALLET\",
       \"metadata\":{\"@context\":\"x\",\"@type\":\"Person\",\"gtin\":\"$GTIN\",\"serial\":\"$SERIAL\",\"name\":\"$SERIAL\",\"origin\":\"2026\"},
       \"details\":{\"givenName\":\"E2E\",\"familyName\":\"Student\",\"email\":\"$EMAIL\",\"notes\":\"E2E Student private note\"}}")
[[ ${mint##*$'\n'} == 200 ]] || fail "mint returned ${mint##*$'\n'}: ${mint%$'\n'*}"
CID=$(echo "${mint%$'\n'*}" | jq -r .cid)

step "pinned metadata carries no PII"
meta=$(curl -sL "$GATEWAY/ipfs/$CID")
[[ $(echo "$meta" | jq -r .name) == "$SERIAL" ]] || fail "pinned name is not the serial"
[[ $(echo "$meta" | jq -r '."@context"|type') == array ]] || fail "pinned @context is not an array"
[[ $(echo "$meta" | jq 'has("description")') == false ]] || fail "pinned metadata has a description"
[[ $(echo "$meta" | grep -c 'private note' || true) == 0 ]] || fail "note leaked into IPFS"

step "roster: details only with credentials"
given=$(curl -s -b "$PORTAL_JAR" "$PORTAL/api/orchestrator/items" | jq -r ".items[]|select(.serial==\"$SERIAL\").givenName")
[[ $given == E2E ]] || fail "portal roster givenName was '$given'"
[[ $(curl -s "$ORCH/items" | jq "[.items[]|select(.serial==\"$SERIAL\")|has(\"givenName\")]|any") == false ]] \
  || fail "unauthenticated /items exposes givenName"

step "scan: hops A-E"
hop "$SSO_JAR" "$RESOLVER/01/$GTIN/21/$SERIAL"
expect "hop A (resolver)" '^30[0-9]$' "$AS/moodle/login/$GTIN?serial=$SERIAL"
hop "$SSO_JAR" "$HOP_URL"
expect "hop B (auth-service login)" '^302$' "$MOODLE/auth/jwtsso/start.php"
hop "$SSO_JAR" "$HOP_URL"
expect "hop C (moodle start)" '^303$' "$AS/moodle/authorize?nonce="
NONCE=$(echo "$HOP_URL" | sed -n 's/.*[?&]nonce=\([0-9a-f]*\).*/\1/p')
hop "$SSO_JAR" "$HOP_URL"
expect "hop D (auth-service authorize)" '^302$' "$MOODLE/auth/jwtsso/callback.php?token="
CALLBACK=$HOP_URL

step "JWT claims"
TOKEN=${CALLBACK#*token=} NONCE=$NONCE EMAIL=$EMAIL node -e '
const [h, p] = process.env.TOKEN.split(".").slice(0, 2).map((s) => JSON.parse(Buffer.from(s, "base64url")));
const checks = {
  kid: h.kid === "hub-key-1", alg: h.alg === "RS256",
  iss: p.iss === "http://localhost:4001/moodle/authorize", aud: p.aud === "http://localhost:8092",
  nonce: p.nonce === process.env.NONCE, email: p.email === process.env.EMAIL,
  given_name: p.given_name === "E2E", ttl: p.exp - p.iat === 300,
};
const bad = Object.keys(checks).filter((k) => !checks[k]);
if (bad.length) { console.error("bad claims: " + bad.join(", ")); process.exit(1); }
' || fail "JWT claims"

hop "$SSO_JAR" "$CALLBACK"
expect "hop E (moodle callback)" '^30[0-9]$' "$MOODLE/"
page=$(curl -sL -b "$SSO_JAR" -c "$SSO_JAR" "$HOP_URL")
grep -q 'You are logged in as' <<<"$page" || fail "hop E: Moodle page lacks 'You are logged in as'"
echo "   $(echo "$page" | grep -o 'You are logged in as[^(]*' | head -1)"

step "Moodle state"
mdb() { docker exec campus-pass-moodle-db mariadb -u bn_moodle bitnami_moodle -N -e "$1"; }
[[ $(mdb "select auth from mdl_user where lower(email)='$EMAIL'") == jwtsso ]] || fail "mdl_user auth is not jwtsso"
[[ $(mdb "select used from mdl_auth_jwtsso_nonces where nonce='$NONCE'") == 1 ]] || fail "nonce not marked used"
jwksurl=$(mdb "select value from mdl_config_plugins where plugin='auth_jwtsso' and name='jwksurl'")
if [[ -z $jwksurl ]]; then
  echo "NOTE: pem fallback"
else
  [[ -z $(mdb "select value from mdl_config_plugins where plugin='auth_jwtsso' and name='publickey'") ]] \
    || fail "publickey is set alongside jwksurl"
fi

step "replay of the callback URL is rejected"
REPLAY_JAR=$WORK/replay.jar
hop "$REPLAY_JAR" "$CALLBACK"
expect "replay" '^30[0-9]$' "$MOODLE/login/index.php"
page=$(curl -sL -b "$REPLAY_JAR" -c "$REPLAY_JAR" "$HOP_URL")
if grep -q 'You are logged in as' <<<"$page"; then fail "replay logged in"; fi

step "revoked credential is refused"
code=$(curl -s -b "$PORTAL_JAR" -o /dev/null -w '%{http_code}' -XPOST "$PORTAL/api/orchestrator/sbt/$GTIN/$SERIAL/active" \
  -H content-type:application/json -d '{"active":false}')
[[ $code == 200 ]] || fail "revoke returned $code"
REVOKED_JAR=$WORK/revoked.jar
hop "$REVOKED_JAR" "$RESOLVER/01/$GTIN/21/$SERIAL"
hop "$REVOKED_JAR" "$HOP_URL"
hop "$REVOKED_JAR" "$HOP_URL"
hop "$REVOKED_JAR" "$HOP_URL"
[[ $HOP_CODE == 403 ]] || fail "revoked rescan ended $HOP_CODE, expected 403"

echo PASS
