import "dotenv/config";
import Fastify from "fastify";
import { SignJWT } from "jose";
import type { HubJwtClaims } from "@campus-pass/shared";
import { loadKeys } from "./keys.js";

const PORT = Number(process.env.PORT ?? 4001);
const ISSUER = process.env.ISSUER ?? "https://id-hub.local";
const AUDIENCE = process.env.AUDIENCE ?? "https://moodle.local";
const KEY_ID = process.env.KEY_ID ?? "hub-key-1";
const SELF_URL = process.env.SELF_URL ?? `http://localhost:${PORT}`;
const ORCHESTRATOR_URL = process.env.BLOCKCHAIN_ORCHESTRATOR_URL ?? "http://localhost:4002";
const MOODLE_URL = process.env.MOODLE_URL ?? "http://localhost:8092";
const MOODLE_ISSUER_URL = process.env.MOODLE_ISSUER_URL ?? `${SELF_URL}/moodle/authorize`;
const ORCHESTRATOR_API_TOKEN = process.env.ORCHESTRATOR_API_TOKEN ?? "";
if (!ORCHESTRATOR_API_TOKEN) {
  throw new Error("ORCHESTRATOR_API_TOKEN is required");
}
const SSO_PENDING_COOKIE = "cp_sso_pending";
const DEFAULT_SSO_TARGET = process.env.MOODLE_TARGET_URL ?? "http://localhost:5055/moodle-callback";

// Role/course access is an enrollment fact, not something a scanned link or a
// client request should get to assert — a resolver link is untrusted input.
// This stands in for a real enrollment table/service; keyed by program (gtin).
const ENROLLMENT_BY_PROGRAM: Record<string, { role: string; coursePermissions: string[] }> = {
  "09521234500001": { role: "student", coursePermissions: ["cs101", "cs220"] },
};
function lookupEnrollment(gtin: string) {
  return ENROLLMENT_BY_PROGRAM[gtin] ?? { role: "member", coursePermissions: [] };
}

const keys = await loadKeys(KEY_ID);
const app = Fastify({ logger: true });

app.get("/health", async () => ({ status: "ok" }));

// Step 6 of the HLD's authorization flow: expose the Hub's public key as a JWKS
// so relying parties (e.g. Moodle's auth_jwtsso plugin) can verify issued JWTs.
app.get("/.well-known/jwks.json", async () => ({ keys: [keys.publicJwk] }));

// HLD §3: "OIDC compatibility". This isn't a full OAuth2 authorization-code
// server (no /authorize redirect UI, no /token exchange) — it's a JWT-bearer
// SSO issuer, which is exactly what Moodle's auth_jwtsso plugin expects. The
// discovery document below is honest about that: response_types_supported
// only lists id_token, and there's deliberately no authorization_endpoint.
app.get("/.well-known/openid-configuration", async () => ({
  issuer: ISSUER,
  jwks_uri: `${SELF_URL}/.well-known/jwks.json`,
  token_endpoint: `${SELF_URL}/auth/verify-sbt`,
  id_token_signing_alg_values_supported: ["RS256"],
  subject_types_supported: ["public"],
  response_types_supported: ["id_token"],
  claims_supported: ["sub", "gtin", "serial", "role", "course_permissions", "iss", "aud", "iat", "exp"],
}));

interface SbtRecord {
  tokenId: string;
  owner: string;
  tokenURI: string;
  active: boolean;
}

type IssueResult =
  | { ok: true; token: string; subject: string }
  | { ok: false; status: number; error: string };

// Steps 3-4 of the HLD's authorization flow, shared by both the JSON API and the
// browser SSO redirect below. The subject is always the SBT's actual on-chain
// owner — never trusted from client input — otherwise anyone could request a
// JWT claiming to be any wallet, which would defeat the point of gating on
// on-chain ownership at all.
type RecordResult =
  | { ok: true; record: SbtRecord }
  | { ok: false; status: number; error: string };

async function fetchActiveRecord(gtin: string, serial: string): Promise<RecordResult> {
  const recordRes = await fetch(`${ORCHESTRATOR_URL}/sbt/${encodeURIComponent(gtin)}/${encodeURIComponent(serial)}`);

  if (recordRes.status === 404) {
    return { ok: false, status: 404, error: "No SBT minted for this item" };
  }
  if (!recordRes.ok) {
    return { ok: false, status: 502, error: "Blockchain Orchestrator unavailable" };
  }

  const record = (await recordRes.json()) as SbtRecord;
  if (!record.active) {
    return { ok: false, status: 403, error: "SBT is not active for this item" };
  }
  return { ok: true, record };
}

async function issueJwt(gtin: string, serial: string, role: string, coursePermissions: string[]): Promise<IssueResult> {
  const found = await fetchActiveRecord(gtin, serial);
  if (!found.ok) {
    return found;
  }
  const { record } = found;

  const claims: HubJwtClaims = {
    sub: record.owner,
    gtin,
    serial,
    role,
    course_permissions: coursePermissions,
    iss: ISSUER,
    aud: AUDIENCE,
  };

  const token = await new SignJWT({ ...claims })
    .setProtectedHeader({ alg: "RS256", kid: keys.kid })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setExpirationTime("15m")
    .sign(keys.privateKey);

  return { ok: true, token, subject: record.owner };
}

interface VerifySbtBody {
  gtin: string;
  serial: string;
  role?: string;
  coursePermissions?: string[];
}

// JSON API form — used by the portals and by anything that wants a token
// without a browser redirect.
app.post<{ Body: VerifySbtBody }>("/auth/verify-sbt", async (request, reply) => {
  const { gtin, serial, role = "member", coursePermissions = [] } = request.body;
  if (!gtin || !serial) {
    return reply.code(400).send({ error: "gtin and serial are required" });
  }

  const result = await issueJwt(gtin, serial, role, coursePermissions);
  if (!result.ok) {
    return reply.code(result.status).send({ error: result.error });
  }
  return { token: result.token, subject: result.subject };
});

interface SsoLoginParams {
  gtin: string;
}
interface SsoLoginQuery {
  serial: string;
  target?: string;
}

// The browser-facing entry point HLD §5 actually describes: this is what the
// GS1 Resolver's "Authorized Access" link points at. Steps 3-5 of the sequence
// diagram happen inside this one request, ending in a redirect to the target
// service (e.g. Moodle) with the JWT attached — step 6 (validation) is the
// target's job, using the JWKS above.
//
// gtin is a path segment (not a query param) so that when the resolver appends
// its own `?serial=...` qualifier to this URL, there's only ever one `?` in it
// — the vendored resolver's query-append is a plain string concat and produces
// a malformed URL if the href already has a query string (see DECISIONS.md).
app.get<{ Params: SsoLoginParams; Querystring: SsoLoginQuery }>("/sso/login/:gtin", async (request, reply) => {
  const { gtin } = request.params;
  const { serial, target } = request.query;
  if (!gtin || !serial) {
    return reply.code(400).send({ error: "gtin and serial are required" });
  }

  const { role, coursePermissions } = lookupEnrollment(gtin);
  const result = await issueJwt(gtin, serial, role, coursePermissions);
  if (!result.ok) {
    return reply.code(result.status).send({ error: result.error });
  }

  const redirectUrl = new URL(target ?? DEFAULT_SSO_TARGET);
  redirectUrl.searchParams.set("token", result.token);
  return reply.redirect(redirectUrl.toString(), 302);
});

interface MoodleJwtClaims extends HubJwtClaims {
  email: string;
  given_name: string;
  family_name: string;
  nonce: string;
}

interface EnrollmentDetails {
  givenName: string;
  familyName: string;
  email: string | null;
}

// Moodle's start.php discards everything but nonce/aud/redirect when it bounces the
// browser to /moodle/authorize, so which student is signing in has to ride in a cookie
// set on this origin. Cookies ignore ports, so it comes back on the return hop. The 300 s
// life matches the plugin's noncelifetime.
function readCookie(header: string | undefined, name: string): string | undefined {
  for (const part of (header ?? "").split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return undefined;
}
const pendingCookie = (value: string, maxAge: number) =>
  `${SSO_PENDING_COOKIE}=${value}; Path=/moodle; Max-Age=${maxAge}; HttpOnly; SameSite=Lax`;

// SP-initiated bridge for Moodle's auth_jwtsso (the resolver's authenticate link points here).
app.get<{ Params: SsoLoginParams; Querystring: { serial?: string } }>("/moodle/login/:gtin", async (request, reply) => {
  const { gtin } = request.params;
  const { serial } = request.query;
  if (!gtin || !serial) {
    return reply.code(400).send({ error: "gtin and serial are required" });
  }
  const pending = Buffer.from(JSON.stringify({ gtin, serial })).toString("base64url");
  reply.header("set-cookie", pendingCookie(pending, 300));
  return reply.redirect(`${MOODLE_URL}/auth/jwtsso/start.php`, 302);
});

// Moodle sends the browser here with its nonce; this URL is the plugin's `issuer`
// setting and the JWT `iss` (compared as a string, never fetched).
app.get<{ Querystring: { nonce?: string; aud?: string; redirect?: string } }>("/moodle/authorize", async (request, reply) => {
  const { nonce, aud, redirect } = request.query;
  const callbackUrl = `${MOODLE_URL}/auth/jwtsso/callback.php`;
  if (!nonce || !/^[0-9a-f]{32}$/.test(nonce) || aud !== MOODLE_URL || redirect !== callbackUrl) {
    return reply.code(400).send({ error: "Invalid authorize request" });
  }

  const raw = readCookie(request.headers.cookie, SSO_PENDING_COOKIE);
  let pending: { gtin?: unknown; serial?: unknown } = {};
  try {
    pending = raw ? JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) : {};
  } catch {
    // falls through to the missing-cookie 400
  }
  if (typeof pending.gtin !== "string" || typeof pending.serial !== "string") {
    return reply.code(400).send({ error: "No pending sign-in; start from the credential link" });
  }
  const { gtin, serial } = pending;
  reply.header("set-cookie", pendingCookie("", 0));

  const found = await fetchActiveRecord(gtin, serial);
  if (!found.ok) {
    return reply.code(found.status).send({ error: found.error });
  }

  const detailsRes = await fetch(
    `${ORCHESTRATOR_URL}/enrollments/${encodeURIComponent(gtin)}/${encodeURIComponent(serial)}/details`,
    { headers: { authorization: `Bearer ${ORCHESTRATOR_API_TOKEN}` } },
  );
  if (detailsRes.status !== 404 && !detailsRes.ok) {
    return reply.code(502).send({ error: "Blockchain Orchestrator unavailable" });
  }
  const details = detailsRes.ok ? ((await detailsRes.json()) as EnrollmentDetails) : null;
  if (!details?.email) {
    return reply.code(409).send({ error: "No email on file for this student; ask Student Affairs to add one" });
  }

  const { role, coursePermissions } = lookupEnrollment(gtin);
  const claims: MoodleJwtClaims = {
    sub: found.record.owner,
    gtin,
    serial,
    role,
    course_permissions: coursePermissions,
    email: details.email,
    given_name: details.givenName,
    family_name: details.familyName,
    nonce,
    iss: MOODLE_ISSUER_URL,
    aud: MOODLE_URL,
  };
  const token = await new SignJWT({ ...claims })
    .setProtectedHeader({ alg: "RS256", kid: keys.kid })
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(keys.privateKey);

  const target = new URL(callbackUrl);
  target.searchParams.set("token", token);
  return reply.redirect(target.toString(), 302);
});

app.listen({ port: PORT, host: "0.0.0.0" }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
