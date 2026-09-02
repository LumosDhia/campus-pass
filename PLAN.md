# Plan

## Now
- [ ] Nothing blocking. Full HLD compliance audit (2026-09-02) verified every clause; project has since fully committed to the campus/student framing (product demo data removed).

## Next
- Moodle SSO: actually install Moodle locally and wire up `auth_jwtsso` against the Auth Service's JWKS endpoint and `/sso/login/:gtin` (identified + the redirect endpoint built and tested against a stub target, but never against real Moodle)
- GDPR: decide a real policy for PII in IPFS-pinned metadata (see DECISIONS.md finding) — currently undecided, just documented. `enrollment_details` (a 4th Postgres table, not yet built) was proposed as the fix — move real names there, access-controlled, instead of public IPFS.
- JSON-LD: define a proper extended `@context` for `ethicalClaims`/`supplyChain`/`assembly` instead of bare extra keys (see DECISIONS.md finding) — lower priority now that there's no product demo data exercising those fields, but the passport rendering code is still generic and this still applies whenever it's used
- Consider upstreaming the three GS1 Resolver patches (DECISIONS.md) as a PR to `gs1/GS1_DigitalLink_Resolver_CE` — they're small, self-contained, and fix real crashes; right now they only live in this repo's copy
- No auth on the Student Affairs Portal or the orchestrator's write endpoints — anyone who can reach the ports can enroll/revoke/log achievements or register programs. A `registrar_users` table was proposed but not built.
- `ops/resolver-entries/load.sh` only wires up the one pre-existing member (`09521234500001`/`S20240117`) — a new program added via the portal has no resolver entry unless one is created manually

## Done
- Full backend loop working locally: GS1 resolver **actually running** (not just vendored) with real link data, SoulboundToken contract (mint, revoke, non-transferable, append-only claims registry), Auth Service (RS256 JWT + JWKS + OIDC discovery doc, gated on credential status derived from chain — not client input), Blockchain Orchestrator (IPFS pinning + mint/batch-mint/status/claims/revoke, Redis-cached verification reads, GS1 Digital Link URI generation)
- **Postgres persistence added**: `programs` (real, shared table — 7 seeded university programs, replacing per-browser localStorage), `students_index` (roster read-cache, replaces replaying `Minted` events from block 0), `claims_index` (achievements read-cache). Chain stays authoritative for status/ownership/claims; Postgres is a write-through read-index. One-time `pnpm backfill` script (idempotent, safe to re-run) synced everything minted before these tables existed.
- Student Affairs Portal enrollment form redesigned: Program is a dropdown (real names) with an "+ Add new program" flow showing separate, always-visible Program name / auto-generated read-only Program code fields; Student ID and wallet address pre-filled with random-but-editable values (regenerate buttons); Cohort replaced with a "Signing up year" dropdown
- Both portals rebuilt from the product-passport framing to the student framing (Student Passport, Student Affairs Portal), dark/minimal UI; portal restored to render all HLD-required fields generically (ingredients, supply chain, "Technical Docs" assembly/recycling, warranty, ethical claims) — this had regressed during the student rebrand and was caught by the compliance audit
- Achievement/claims registry added to the contract + orchestrator (`addClaim`, `getClaims`) so information can be attached to a credential after minting, not just at mint time
- Redis caching layer for blockchain verification reads (HLD §7), with explicit invalidation on revoke — cache hit/miss verified live
- Minimal multi-language support (EN/FR) on the Student Passport (HLD §6 Phase 4)
- Batch mint endpoint for mass-encoding (HLD §6 Phase 5), tested with mixed success/failure results
- Full end-to-end scan-to-outcome tested through the *actual running resolver*, using the **literal HLD §5 URL format** (`/01/gtin/21/serial`, no workaround), for all four HLD user stories — including 4.2 cosmetics and 4.3 furniture as generic proof the resolver/passport rendering isn't campus-specific. That demo data (cosmetic, furniture) was since **removed** — chain credentials revoked, Postgres rows deleted, resolver entries and `ops/resolver-entries/*.json` files removed — once the project fully committed to the campus framing. The underlying rendering code is untouched and generic.
- Three bugs found in the vendored GS1 Resolver were patched directly in our copy's source (not just worked around) — qualifier-path crash, malformed redirect URLs, non-idempotent `POST /new` — see DECISIONS.md

## Notes
- This project's `gtin`/`serial` fields are program code / student ID, not literal GS1 barcodes — see DECISIONS.md
- Local-only: no deploys, no real testnet yet. Everything scoped to run on one machine.
- Two harmless orphaned documents exist in the resolver's local Mongo (leftover from working out its actual qualifier model, unrelated to the removed product demo) — not referenced by any working resolution path, safe to ignore or wipe the `resolver_resolver-database-volume` Docker volume to start clean.
