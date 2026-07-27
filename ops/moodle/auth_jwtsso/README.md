# JWT SSO Authentication for Moodle (`auth_jwtsso`)

This plugin allows Moodle to accept signed JSON Web Tokens (JWT) from an external Identity Provider (IdP) such as **Odoo**, **Keycloak**, or a **custom Python/Flask IdP** to authenticate users.  

It supports **RS/ES algorithms**, **JWKS or static PEM keys**, and enforces **strict claim validation** (`iss`, `aud`, `exp`, `iat`, `nonce`).  
Optional features include detailed event logging, nonce cleanup tasks, and SP-initiated login.

## 🧩 Installation

1. Place this plugin in:  
```

auth/jwtsso

```
2. Visit **Site administration → Notifications** to complete installation.  
3. Enable it under:  
**Site administration → Plugins → Authentication → Manage authentication**

## ⚙️ Configuration

Go to  
**Site administration → Plugins → Authentication → JWT SSO**  
and set the following values:

| Setting | Description |
|----------|--------------|
| **Issuer URL (`iss`)** | The IdP’s unique issuer string (e.g. `https://idp.example.com/test-idp`). |
| **Audience (`aud`)** | Expected audience claim. Defaults to `$CFG->wwwroot`. |
| **JWKS endpoint** | Optional. URL returning JSON Web Key Set (for rotating keys). |
| **Public key (PEM)** | Static PEM-encoded public key for signature validation. |
| **Allowed algorithms** | Comma-separated list (default: `RS256,ES256`). |
| **Just-in-time user creation** | Create Moodle users automatically on first login. |
| **Show SSO login button** | Adds “Login via external SSO” to the login page. |
| **Detailed events** | Log detailed `auth_jwtsso` events (no token contents). |
| **Nonce lifetime** | Default `300` seconds. Controls replay protection. |
| **Claim for username/email** | Defaults to `email`. |

## 🔁 Flows

### IdP-initiated flow

Your IdP redirects the user to Moodle with a signed JWT:

```

[https://moodle.example.com/auth/jwtsso/callback.php?token=](https://moodle.example.com/auth/jwtsso/callback.php?token=)<JWT>

```

The JWT **must include** these claims:
| Claim | Purpose |
|--------|----------|
| `iss` | Matches the configured Issuer. |
| `aud` | Matches your Moodle site URL. |
| `exp` / `iat` | Expiry and issued-at timestamps. |
| `nonce` | Required for replay protection. |
| `email` / `sub` / `given_name` / `family_name` | User identity attributes. |

Signature validation uses the JWKS endpoint or the configured PEM key.

### SP-initiated flow

When the SSO button is enabled, Moodle:

1. Generates and stores a one-time **nonce**.
2. Redirects the browser to your IdP’s **Issuer URL** with parameters:
```

nonce, aud, redirect_uri

```
3. The IdP signs a JWT containing the same nonce and redirects back:
```

/auth/jwtsso/callback.php?token=<JWT>

```
4. Moodle validates signature and claims, consumes the nonce (one-time), and logs the user in.

## 🔒 Security Model

- HTTPS required for all endpoints.  
- Nonce/jti replay protection enforced by database.  
- Clock skew tolerance of ±5 minutes.  
- Issuer and audience must exactly match configuration.  
- Algorithm allow-list prevents “none” or weak algs.  
- JWKS caching and `kid` selection supported.  
- No raw tokens are logged, even in debug mode.

## 🧰 Developer Tools

### ✅ Example Python IdP

A complete Flask-based example IdP is included under:
```

auth/jwtsso/examples/idp_example.py

```

It demonstrates:
- Fetching a valid nonce from Moodle via `/auth/jwtsso/start.php`
- Issuing a signed JWT with test keys from:
```

auth/jwtsso/tests/fixtures/private.pem

```
- Redirecting the user to `/auth/jwtsso/callback.php`

Read the full guide in:
```

auth/jwtsso/examples/README.md

````

### 🧪 Automated tests

- **Unit tests:** cover JWT validation and signature verification.
- **Behat tests:** simulate both valid and invalid SSO logins.

Run via:
```bash
vendor/bin/phpunit auth/jwtsso/tests/validator_test.php
vendor/bin/behat --tags=@auth_jwtsso
````

## 🧹 Maintenance and Tasks

A scheduled task cleans up expired nonces:

```
auth_jwtsso\task\cleanup_nonces
```

You can configure its frequency in
**Site administration → Server → Scheduled tasks.**

## 👤 Maintainer

**Christopher Reimann**
[christopher@learningsecured.com](mailto:christopher@learningsecured.com)
License: [GPL v3+](https://www.gnu.org/licenses/gpl-3.0.html)

## 🧠 Summary

`auth_jwtsso` provides a secure, flexible bridge between Moodle and external authentication systems using **standards-based JWTs**.
It is ideal for integrating Moodle with custom IdPs, Odoo, or enterprise SSO platforms without deploying a full OAuth2 or SAML stack.

