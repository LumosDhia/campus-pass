import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "cp_portal_session";
export const SESSION_MAX_AGE = 28800;

function secret(): string {
  const value = process.env.PORTAL_SESSION_SECRET;
  if (!value || value.length < 32) {
    throw new Error("PORTAL_SESSION_SECRET must be set to at least 32 characters");
  }
  return value;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function signSession(username: string): string {
  const exp = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE;
  const payload = `${username}.${exp}`;
  return `${payload}.${sign(payload)}`;
}

export function verifySession(value: string | undefined): string | null {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  const [username, exp, signature] = parts;
  const expected = Buffer.from(sign(`${username}.${exp}`));
  const given = Buffer.from(signature);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  if (Number(exp) < Date.now() / 1000) return null;
  return username;
}

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  maxAge: SESSION_MAX_AGE,
} as const;
