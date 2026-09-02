# Standards

## Language / framework
- TypeScript everywhere except `services/resolver` (vendored Python — its NOTICE.md tracks the
  three upstream bugs patched directly in its source; check there before touching it further).
- pnpm workspaces monorepo. Package scope: `@campus-pass/*`.
- Backends: Fastify. Frontends: Next.js App Router, React 19.
- Blockchain: viem (not ethers) for all new chain interaction code.
- JWT: `jose`, not `jsonwebtoken`.

## Testing
- Contract changes require a Hardhat test in `contracts/test/` — non-transferability and access
  control (`onlyOwner`) are the two properties most worth re-checking on every change.
- No frontend test suite yet. Verify UI changes by actually running the dev servers and hitting
  the pages (curl for server-rendered content is an acceptable substitute when no browser tool
  is available — confirm the real served output, not just that it compiles).

## Style
- Dark, minimal UI: hand-written CSS custom properties in each app's `globals.css`, no UI
  framework, one accent color. Don't introduce Tailwind or a component library without discussing it first.
- No comments explaining *what* code does — only *why*, when non-obvious (see root CLAUDE.md's parent instructions).

## Things to avoid
- Don't rename `gtin`/`serial` to student-specific names across the codebase — they're the
  generic two-part identifier the GS1 resolver, contract, and JWT claims all share. Relabel in
  UI copy only. See DECISIONS.md.
- Don't add fields to `DppMetadata` (`packages/shared`) for one-off UI needs — prefer the
  on-chain claims registry (`addClaim`) for anything that should be a permanent, timestamped record.
- Local dev only — don't add production secrets, real RPC endpoints, or mainnet config until asked.
- Never trust a `subject`/`role`/`coursePermissions`-shaped field from a request body or query
  string for anything that ends up in a JWT claim — derive identity from the chain (`ownerOf`) and
  permissions from a server-side lookup. See the 2026-09-02 DECISIONS.md entries; this was a real
  gap that got fixed once, don't reintroduce it.
- When authoring `services/resolver` link entries for a serialized identifier: declare a
  `"qualifiers": [{"21": "{name}"}]` template on that entry and use `{name}` in the href, alongside
  a separate unqualified base entry — same anchor, two array entries, mirroring GS1's own test
  fixtures. Skipping the qualifier template is what caused the crash this audit found and patched
  (DECISIONS.md); the crash itself is now fixed too, but a document with no matching qualifier
  entry still correctly 404s rather than resolving — so it still won't work without one.
- Don't assume a service "works" because it's vendored and copied over — `services/resolver` sat
  unrun for an entire session before this audit actually started it and found it was misconfigured
  (`.env` vs `.env.example`) and buggy. Actually run everything before claiming it's done.
