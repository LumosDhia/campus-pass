import postgres from "postgres";

const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgres://campus_pass:campus_pass@127.0.0.1:5432/campus_pass";

export const sql = postgres(DATABASE_URL);

// Real program names for the seeded demo university — replaces the earlier
// placeholder ("NordicPoly — Computer Science" only) now that programs are a
// first-class, shared row instead of per-browser localStorage.
const SEED_PROGRAMS = [
  { code: "09521234500001", name: "NordicPoly — Computer Science" },
  { code: "09521000000018", name: "NordicPoly — Business Administration" },
  { code: "09521000000025", name: "NordicPoly — Mechanical Engineering" },
  { code: "09521000000032", name: "NordicPoly — Nursing" },
  { code: "09521000000049", name: "NordicPoly — Data Science" },
  { code: "09521000000056", name: "NordicPoly — Architecture" },
  { code: "09521000000063", name: "NordicPoly — Environmental Science" },
] as const;

/**
 * Postgres here is a read-index + operational layer, not the source of truth:
 * the chain stays authoritative for credential status, ownership, and claims
 * (see DECISIONS.md). These tables exist because that authority is expensive
 * to query in bulk (students_index avoids replaying every Minted event on
 * every roster load) or has no on-chain home at all (programs).
 */
export async function initDb() {
  await sql`
    CREATE TABLE IF NOT EXISTS programs (
      code TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS students_index (
      gtin TEXT NOT NULL,
      serial TEXT NOT NULL,
      token_id TEXT NOT NULL,
      owner_address TEXT NOT NULL,
      token_uri TEXT,
      active BOOLEAN NOT NULL DEFAULT true,
      minted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (gtin, serial)
    )
  `;

  await sql`ALTER TABLE students_index DROP COLUMN IF EXISTS name`;

  await sql`
    CREATE TABLE IF NOT EXISTS enrollment_details (
      gtin TEXT NOT NULL,
      serial TEXT NOT NULL,
      given_name TEXT NOT NULL,
      family_name TEXT NOT NULL,
      email TEXT CHECK (email IS NULL OR email ~ '^[^@\\s]+@[^@\\s]+$'),
      notes TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (gtin, serial),
      FOREIGN KEY (gtin, serial) REFERENCES students_index (gtin, serial) ON DELETE CASCADE
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS claims_index (
      id SERIAL PRIMARY KEY,
      gtin TEXT NOT NULL,
      serial TEXT NOT NULL,
      label TEXT NOT NULL,
      value TEXT NOT NULL,
      logged_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS claims_index_student ON claims_index (gtin, serial)`;

  await sql`
    CREATE TABLE IF NOT EXISTS registrar_users (
      username TEXT PRIMARY KEY CHECK (username ~ '^[a-z0-9_-]{3,32}$'),
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  for (const program of SEED_PROGRAMS) {
    await sql`
      INSERT INTO programs (code, name) VALUES (${program.code}, ${program.name})
      ON CONFLICT (code) DO NOTHING
    `;
  }
}

export async function getRegistrarHash(username: string): Promise<string | null> {
  const rows = await sql<{ password_hash: string }[]>`
    SELECT password_hash FROM registrar_users WHERE username = ${username}
  `;
  return rows[0]?.password_hash ?? null;
}

export async function upsertRegistrar(username: string, passwordHash: string): Promise<void> {
  await sql`
    INSERT INTO registrar_users (username, password_hash) VALUES (${username}, ${passwordHash})
    ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash
  `;
}

export interface ProgramRow {
  code: string;
  name: string;
}

export async function listPrograms(): Promise<ProgramRow[]> {
  return sql<ProgramRow[]>`SELECT code, name FROM programs ORDER BY name`;
}

export async function insertProgram(code: string, name: string): Promise<void> {
  await sql`
    INSERT INTO programs (code, name) VALUES (${code}, ${name})
    ON CONFLICT (code) DO NOTHING
  `;
}

export async function upsertStudent(row: {
  gtin: string;
  serial: string;
  tokenId: string;
  ownerAddress: string;
  tokenURI?: string;
}): Promise<void> {
  await sql`
    INSERT INTO students_index (gtin, serial, token_id, owner_address, token_uri, active)
    VALUES (${row.gtin}, ${row.serial}, ${row.tokenId}, ${row.ownerAddress}, ${row.tokenURI ?? null}, true)
    ON CONFLICT (gtin, serial) DO UPDATE SET
      token_id = EXCLUDED.token_id,
      owner_address = EXCLUDED.owner_address,
      token_uri = EXCLUDED.token_uri
  `;
}

export async function setStudentActive(gtin: string, serial: string, active: boolean): Promise<void> {
  await sql`UPDATE students_index SET active = ${active} WHERE gtin = ${gtin} AND serial = ${serial}`;
}

export interface StudentIndexRow {
  gtin: string;
  serial: string;
  token_id: string;
  owner_address: string;
  token_uri: string | null;
  active: boolean;
  minted_at: Date;
}

export async function listStudents(): Promise<StudentIndexRow[]> {
  return sql<StudentIndexRow[]>`SELECT * FROM students_index ORDER BY minted_at DESC`;
}

export async function setStudentTokenUri(gtin: string, serial: string, tokenURI: string): Promise<void> {
  await sql`UPDATE students_index SET token_uri = ${tokenURI} WHERE gtin = ${gtin} AND serial = ${serial}`;
}

export interface EnrollmentDetails {
  gtin: string;
  serial: string;
  givenName: string;
  familyName: string;
  email: string | null;
  notes: string | null;
}

export async function upsertEnrollmentDetails(row: EnrollmentDetails, { overwrite }: { overwrite: boolean }): Promise<void> {
  if (overwrite) {
    await sql`
      INSERT INTO enrollment_details (gtin, serial, given_name, family_name, email, notes)
      VALUES (${row.gtin}, ${row.serial}, ${row.givenName}, ${row.familyName}, ${row.email}, ${row.notes})
      ON CONFLICT (gtin, serial) DO UPDATE SET
        given_name = EXCLUDED.given_name,
        family_name = EXCLUDED.family_name,
        email = EXCLUDED.email,
        notes = EXCLUDED.notes,
        updated_at = now()
    `;
  } else {
    await sql`
      INSERT INTO enrollment_details (gtin, serial, given_name, family_name, email, notes)
      VALUES (${row.gtin}, ${row.serial}, ${row.givenName}, ${row.familyName}, ${row.email}, ${row.notes})
      ON CONFLICT (gtin, serial) DO NOTHING
    `;
  }
}

export async function getEnrollmentDetails(gtin: string, serial: string): Promise<EnrollmentDetails | null> {
  const rows = await sql<{ given_name: string; family_name: string; email: string | null; notes: string | null }[]>`
    SELECT given_name, family_name, email, notes FROM enrollment_details
    WHERE gtin = ${gtin} AND serial = ${serial}
  `;
  const row = rows[0];
  if (!row) return null;
  return { gtin, serial, givenName: row.given_name, familyName: row.family_name, email: row.email, notes: row.notes };
}

export interface StudentWithDetailsRow extends StudentIndexRow {
  given_name: string | null;
  family_name: string | null;
  email: string | null;
  notes: string | null;
}

export async function listStudentsWithDetails(): Promise<StudentWithDetailsRow[]> {
  return sql<StudentWithDetailsRow[]>`
    SELECT s.*, d.given_name, d.family_name, d.email, d.notes
    FROM students_index s LEFT JOIN enrollment_details d USING (gtin, serial)
    ORDER BY s.minted_at DESC
  `;
}

export async function insertClaim(gtin: string, serial: string, label: string, value: string): Promise<void> {
  await sql`INSERT INTO claims_index (gtin, serial, label, value) VALUES (${gtin}, ${serial}, ${label}, ${value})`;
}

/**
 * Replaces one item's entire claims_index history with exactly what's on-chain
 * right now. Used by the backfill script (idempotent — safe to re-run) rather
 * than insertClaim, which only ever appends and would duplicate on a re-run.
 */
export async function resyncClaims(
  gtin: string,
  serial: string,
  claims: { label: string; value: string; loggedAt: Date }[]
): Promise<void> {
  await sql.begin(async (tx) => {
    await tx`DELETE FROM claims_index WHERE gtin = ${gtin} AND serial = ${serial}`;
    for (const claim of claims) {
      await tx`
        INSERT INTO claims_index (gtin, serial, label, value, logged_at)
        VALUES (${gtin}, ${serial}, ${claim.label}, ${claim.value}, ${claim.loggedAt})
      `;
    }
  });
}

export interface ClaimIndexRow {
  label: string;
  value: string;
  logged_at: Date;
}

export async function listClaims(gtin: string, serial: string): Promise<ClaimIndexRow[]> {
  return sql<ClaimIndexRow[]>`
    SELECT label, value, logged_at FROM claims_index
    WHERE gtin = ${gtin} AND serial = ${serial}
    ORDER BY logged_at ASC
  `;
}
