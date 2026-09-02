#!/usr/bin/env bash
# Loads the CampusPass member/student GS1 Digital Link entry into a running
# resolver (services/resolver, `docker compose up -d --build` from that
# directory first — see its README).
#
# The product demo entries (cosmetic, furniture — the pre-student-pivot HLD
# 4.2/4.3 examples) were removed once the project fully committed to the
# campus framing; see DECISIONS.md. The rendering code that supports
# ingredients/supply chain/Technical Docs is still generic and intact in
# apps/student-passport — nothing stops a future product-shaped entity from
# using it, there's just no demo data for one anymore.
#
# The file has a base (GTIN-only) document and a serialized one with a proper
# qualifier template (`"qualifiers": [{"21": "{...}"}]`) — this is what makes
# the literal HLD §5 URL shape `/01/<gtin>/21/<serial>` actually resolve. Our
# local copy of the resolver has three upstream bugs patched (see DECISIONS.md
# "three real bugs... patched in our vendored copy") that made this either
# crash or silently misbehave before those patches — rebuild the resolver's
# Docker images (`docker compose up -d --build` + `docker restart
# frontend-proxy-server`) before relying on any of this if you've pulled a
# fresh, unpatched copy of GS1_DigitalLink_Resolver_CE.
#
# Explicitly deletes the base anchor before recreating it, even though
# POST /new's duplicate-on-repeat bug is now patched too — cheap insurance,
# and keeps this script safe to run against an unpatched resolver as well.
set -euo pipefail

RESOLVER_URL="${RESOLVER_URL:-http://localhost:8090}"
TOKEN="${RESOLVER_SESSION_TOKEN:-secret}"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

ANCHORS=("01/09521234500001")
FILES=("member")

for i in "${!FILES[@]}"; do
  f="${FILES[$i]}"
  anchor="${ANCHORS[$i]}"
  echo "== $f: deleting $anchor if present =="
  curl -s -X DELETE "$RESOLVER_URL/api/$anchor" -H "Authorization: Bearer $TOKEN" >/dev/null || true

  echo "== $f: creating =="
  curl -sf -X POST "$RESOLVER_URL/api/new" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d @"$DIR/$f.json"
  echo
done
