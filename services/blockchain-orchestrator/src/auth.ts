import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";

const SERVICE_TOKEN = process.env.ORCHESTRATOR_API_TOKEN;
if (!SERVICE_TOKEN) {
  throw new Error("ORCHESTRATOR_API_TOKEN is not set");
}

const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, KEYLEN, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

// Verified against when the username is unknown, so response timing does not
// reveal which usernames exist.
const DUMMY_HASH = hashPassword("dummy-password-for-unknown-users");

export function verifyPassword(password: string, stored: string | null | undefined): boolean {
  const [scheme, n, r, p, salt, hash] = (stored ?? DUMMY_HASH).split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64");
  const actual = scryptSync(password, Buffer.from(salt, "base64"), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  });
  return timingSafeEqual(actual, expected) && stored != null;
}

export function hasServiceToken(request: FastifyRequest): "valid" | "absent" | "invalid" {
  const header = request.headers.authorization;
  if (!header) return "absent";
  const match = /^Bearer (.+)$/.exec(header);
  if (!match) return "invalid";
  const given = Buffer.from(match[1]);
  const expected = Buffer.from(SERVICE_TOKEN!);
  return given.length === expected.length && timingSafeEqual(given, expected) ? "valid" : "invalid";
}

export async function requireServiceToken(request: FastifyRequest, reply: FastifyReply) {
  if (hasServiceToken(request) !== "valid") {
    return reply.code(401).send({ error: "Missing or invalid service token" });
  }
}
