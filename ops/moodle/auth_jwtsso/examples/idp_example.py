#!/usr/bin/env python3
"""
Example JWT SSO Identity Provider for Moodle's auth_jwtsso plugin.

This demonstrates a full *IdP-initiated* flow:
  1. Requests a fresh nonce from Moodle’s /auth/jwtsso/start.php
  2. Issues a signed JWT containing that nonce and user info
  3. Redirects the browser to Moodle’s callback endpoint with the token

⚠️  This example is for demonstration only. Do not use in production.
"""

import os
from flask import Flask, request, redirect
import requests
import jwt
import time
from urllib.parse import urlparse, parse_qs

# === Configuration ==========================================================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PRIVATE_KEY_FILE = os.path.join(BASE_DIR, "../tests/fixtures/private.pem")

MOODLE_BASE = "https://reimann-dev.ddns.net"
MOODLE_START = f"{MOODLE_BASE}/auth/jwtsso/start.php"
MOODLE_CALLBACK = f"{MOODLE_BASE}/auth/jwtsso/callback.php"

ISSUER = f"{MOODLE_BASE}/test-idp"
AUDIENCE = f"{MOODLE_BASE}"  # must match plugin setting exactly

# ============================================================================

app = Flask(__name__)

def fetch_nonce():
    """Call Moodle’s start.php endpoint to get a valid nonce."""
    print(f"→ Requesting fresh nonce from {MOODLE_START}")
    r = requests.get(MOODLE_START, allow_redirects=False)
    location = r.headers.get("Location", "")
    if not location:
        raise RuntimeError("Moodle did not return a redirect with nonce.")
    query = parse_qs(urlparse(location).query)
    nonce = query.get("nonce", [None])[0]
    if not nonce:
        raise RuntimeError("Nonce not found in redirect URL.")
    print(f"✓ Got nonce: {nonce}")
    return nonce

@app.route("/sso/login")
def sso_login():
    """Simulate IdP-initiated login."""
    email = request.args.get("email", "behat@example.com")

    # 1. Fetch a valid nonce from Moodle
    nonce = fetch_nonce()

    # 2. Create and sign a JWT
    now = int(time.time())
    claims = {
        "iss": ISSUER,
        "aud": AUDIENCE,
        "iat": now,
        "exp": now + 600,
        "nonce": nonce,
        "email": email,
        "given_name": "Behat",
        "family_name": "User",
    }

    private_key = open(PRIVATE_KEY_FILE).read()
    token = jwt.encode(claims, private_key, algorithm="RS256")

    # 3. Redirect the browser to Moodle’s callback endpoint
    callback = f"{MOODLE_CALLBACK}?token={token}"
    print(f"→ Redirecting to: {callback}")
    return redirect(callback)

@app.route("/")
def index():
    """Landing page for convenience."""
    return (
        "<h1>Example JWT SSO IdP</h1>"
        "<p>Visit <code>/sso/login</code> to start the IdP-initiated flow.</p>"
        f"<p>Example: <a href='/sso/login?email=behat@example.com'>"
        f"http://localhost:5000/sso/login?email=behat@example.com</a></p>"
    )

if __name__ == "__main__":
    print(f"Example IdP running at http://localhost:5000/sso/login")
    print(f"Try visiting: http://localhost:5000/sso/login?email=behat@example.com")
    app.run(host="0.0.0.0", port=5000)

