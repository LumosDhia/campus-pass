#!/usr/bin/env bash
# Brings up a local Moodle (ops/moodle/docker-compose.yml) and installs/configures the
# vendored auth_jwtsso plugin to trust this repo's auth-service as its JWT SSO issuer.
#
# KEY_SOURCE=jwks (default): Moodle fetches keys from the Auth Service JWKS endpoint.
# KEY_SOURCE=pem: pins services/auth-service/keys/public.pem instead — use it only if the
# host firewall blocks Docker-bridge -> host traffic (the probe in step 6 tells you).
#
# Requires auth-service running on :4001. Idempotent.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

KEY_SOURCE="${KEY_SOURCE:-jwks}"
MOODLE_URL="http://localhost:8092"
JWKS_URL="http://host.docker.internal:4001/.well-known/jwks.json"
C=campus-pass-moodle
PEM_FILE="$DIR/../../services/auth-service/keys/public.pem"

case "$KEY_SOURCE" in jwks | pem) ;; *) echo "KEY_SOURCE must be jwks or pem" >&2; exit 1 ;; esac

moodle() { docker exec --user daemon "$C" bash -c "cd /bitnami/moodle && $1"; }
cfg() { moodle "php admin/cli/cfg.php --component=auth_jwtsso --name=$1 --set='$2'"; }

echo "== [1/11] docker compose up =="
docker compose up -d

echo "== [2/11] waiting for Moodle's first-run install (up to 10 min) =="
code=000
for _ in $(seq 1 120); do
  code=$(curl -s -o /dev/null -w '%{http_code}' "$MOODLE_URL/login/index.php" || true)
  [ "$code" = "200" ] && break
  sleep 5
done
if [ "$code" != "200" ]; then
  echo "Moodle never came up (last status: $code) - check: docker compose logs moodle" >&2
  exit 1
fi

echo "== [3/11] installing auth_jwtsso =="
docker exec "$C" rm -rf /bitnami/moodle/auth/jwtsso
docker cp "$DIR/auth_jwtsso" "$C:/bitnami/moodle/auth/jwtsso"
docker exec "$C" chown -R daemon:daemon /bitnami/moodle/auth/jwtsso

echo "== [4/11] upgrade.php =="
moodle "php admin/cli/upgrade.php --non-interactive"

echo "== [5/11] config.php curl security ($KEY_SOURCE) =="
# Moodle's curl class blocks 172.16.0.0/12 and every port but 80/443 by default, and
# host-gateway lands in that range. config.php values are forced settings, so they
# also survive the DB. Bitnami keeps the real file in the /bitnami/moodle volume.
real="$(docker exec "$C" readlink -f /opt/bitnami/moodle/config.php)"
if [ "$real" != "/bitnami/moodle/config.php" ]; then
  echo "config.php resolves to $real, expected /bitnami/moodle/config.php" >&2
  exit 1
fi
if [ "$KEY_SOURCE" = "jwks" ]; then
  if ! docker exec "$C" grep -q curlsecurityallowedport /bitnami/moodle/config.php; then
    docker exec -u 0 "$C" sed -i "/require_once(__DIR__ \. '\/lib\/setup\.php');/i \\
\$CFG->curlsecurityallowedport = '4001';\\
\$CFG->curlsecurityblockedhosts = '';" /bitnami/moodle/config.php
  fi
else
  docker exec -u 0 "$C" sed -i '/curlsecurity/d' /bitnami/moodle/config.php
fi
docker exec "$C" php -l /bitnami/moodle/config.php

if [ "$KEY_SOURCE" = "jwks" ]; then
  echo "== [6/11] probing container -> host :4001 =="
  # The image has no curl binary; PHP's libcurl is the same raw client and, unlike
  # Moodle's \curl class, applies none of Moodle's curl security settings.
  rc=0
  status=$(docker exec "$C" php -r '
    $h = curl_init($argv[1]);
    curl_setopt_array($h, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 5]);
    curl_exec($h);
    echo curl_getinfo($h, CURLINFO_HTTP_CODE);
    exit(curl_errno($h));' "$JWKS_URL") || rc=$?
  if [ "$rc" != "0" ] || [ "$status" != "200" ]; then
    echo "JWKS unreachable from the container (curl exit $rc, http ${status:-none}). If exit 28/7, the host firewall drops Docker-bridge -> host traffic to :4001 - allow it, or rerun with KEY_SOURCE=pem" >&2
    exit 1
  fi
  echo "   probe ok $status"
else
  echo "== [6/11] probe skipped (pem) =="
fi

echo "== [7/11] plugin config =="
cfg issuer "http://localhost:4001/moodle/authorize"
cfg audience "$MOODLE_URL"
cfg allowedalgs RS256
cfg autocreate 1
cfg showbutton 1
cfg claim_email email
cfg claim_username email
cfg noncelifetime 300
if [ "$KEY_SOURCE" = "jwks" ]; then
  cfg jwksurl "$JWKS_URL"
  cfg publickey ""
else
  cfg jwksurl ""
  cfg publickey "$(cat "$PEM_FILE")"
fi

echo "== [8/11] enabling jwtsso auth =="
moodle "php admin/cli/cfg.php --name=auth --set=email,jwtsso"

echo "== [9/11] purging caches =="
moodle "php admin/cli/purge_caches.php"

echo "== [10/11] verifying key source =="
if [ "$KEY_SOURCE" = "jwks" ]; then
  docker cp "$DIR/jwks-check.php" "$C:/tmp/jwks-check.php"
  if ! docker exec --user daemon "$C" php /tmp/jwks-check.php; then
    echo "jwks-check failed - see output above; rerun with KEY_SOURCE=pem if the network is the cause" >&2
    exit 1
  fi
else
  PEM_FILE="$PEM_FILE" node -e '
    const crypto = require("crypto"), fs = require("fs");
    const mine = crypto.createPublicKey(fs.readFileSync(process.env.PEM_FILE)).export({ format: "jwk" }).n;
    fetch("http://localhost:4001/.well-known/jwks.json").then((r) => r.json()).then((j) => {
      if (j.keys[0].n !== mine) { console.error("PEM modulus does not match live JWKS"); process.exit(1); }
      console.log("pem modulus matches live JWKS");
    });'
fi

echo "== [11/11] done =="
echo "auth_jwtsso configured (key source: $KEY_SOURCE)"
