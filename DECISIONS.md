# Decisions

Log of non-obvious technical/architectural calls, newest first. One entry per decision.

### 2026-09-02 — Removed the product demo data; fully committed to the campus framing
**What:** Deleted the cosmetic (`03400000000012`/`CR0001`) and furniture (`04012345678901`/`FRN0007`,
`04012345678902`/`FRN0008`+`FRN0009`) items: revoked their credentials on-chain (`active=false` —
chain history itself can't be deleted), removed their rows from `students_index`/`claims_index`,
and deleted their GS1 Resolver entries and `ops/resolver-entries/{cosmetic,furniture}.json` files.
**Why:** This data existed specifically to prove, during the compliance audit above, that the
resolver and passport-rendering code are generic and not campus-specific — HLD §4.2/§4.3's product
scenarios worked end to end. That proof stands on its own (documented below); once made, the data
itself was just clutter left over from before the project pivoted to students, and the user asked
for it removed now that the campus framing is the only one in active use.
**What's intentionally NOT removed:** The generic rendering code in `apps/student-passport` for
`ingredients`/`supplyChain`/`assembly`/`ethicalClaims` — it's dormant, harmless, and would be
needed again if a product-shaped entity is ever reintroduced. Only the demo *data* and the
resolver *entries* for it are gone.
**Alternatives considered:** A full local-chain reset (would also wipe legitimate student
enrollments made since — rejected); leaving the data in place as inert history (rejected — direct
instruction to remove it).

### 2026-09-02 — Full HLD compliance audit: three real bugs found and patched in our vendored copy of the GS1 Resolver
**What:** While actually running `services/resolver` for the first time (it had only ever been
vendored, never started) and wiring real link data for all four HLD user stories, found — and,
per direct instruction, patched in place — three genuine defects in GS1's own Resolver CE v3.0
(community-maintained, not GS1-supported — see its own README disclaimer). All three are fixed in
`services/resolver/{web_server,data_entry_server}/src/*.py` in this repo; **the upstream GitHub
project still has all three**, we only patched our local copy:
1. **Qualifier-path resolution crashed.** Requesting `/01/<gtin>/21/<serial>` against a document
   whose links don't declare a matching `qualifiers` template threw inside
   `web_logic.py::read_document`: two of its return statements (`if not response_links_list: return
   {...}` and the outer `except Exception` handler) returned a bare dict instead of the `(dict,
   header)` tuple every other branch in the function returns. The caller in `web_namespace.py` does
   `response_data, link_header = read_document(...)`, which — because Python happily unpacks a
   2-key dict into its keys — silently "succeeds" and hands `response_data` the *string*
   `"response_status"` instead of a dict, so the very next line (`response_data['response_status']`)
   throws `TypeError: string indices must be integers, not 'str'` and the whole request 500s.
   **Fix:** both return statements now return `(dict, None)`, matching the contract.
2. **Query-string append was a naive string concat.** `_process_response` did
   `response.headers['Location'] += '?' + query_strings` unconditionally — if the target href
   already had its own `?...` query string, this produced a double-`?` URL that silently corrupted
   everything after the first `?` for any downstream parser. **Fix:** appends with `&` when the
   Location already contains `?`, `?` otherwise.
3. **`POST /new` duplicated links on every repeat submission.** `_process_document_upsert` in
   `data_entry_logic.py` matched an existing DB entry by qualifiers, then did
   `existing_db_entry['linkset'].extend(entry['linkset'])` — an unconditional append, so re-posting
   an *identical* document kept growing its link list forever. The correct behavior already existed
   two functions over (`update_document`'s use of `_find_matching_link`, keyed by
   `(linktype, hreflang, context)`, exactly matching what the vendor's own changelog claims PUT
   does) — `_process_document_upsert` just never used it. **Fix:** now merges per-link via
   `_find_matching_link` too, so identical re-posts update in place instead of duplicating.
**Also fixed a real authoring gap on our side, not a resolver bug:** our first attempt at wiring
`/01/GTIN/21/SERIAL` didn't declare a `qualifiers` template on the link at all (GS1's own test
fixtures do — e.g. `"qualifiers": [{"21": "{serialnumber}"}]` with a matching `{serialnumber}`
placeholder in the href). Without that, no entry ever matches an incoming qualifier path, which is
what drove straight into bug #1. `ops/resolver-entries/*.json` now author both an unqualified base
document and a properly-qualified serialized one per anchor, mirroring GS1's own pattern —
`/01/<gtin>/21/<serial>`, the literal HLD §5 shape, now resolves correctly end to end with no
workaround, verified against a real signed-and-JWKS-verified JWT.
**Why patch instead of work around:** direct instruction — "our copy only should work well... in
all situations." A workaround (routing around the bug from our own services) only covers the
specific requests *we* make; a real NFC tag encoded with the literal GS1 path syntax, or any other
caller, would still have hit the crash. Patching the actual defect means the resolver is correct
regardless of caller. Tradeoff: this repo's `services/resolver` now diverges from upstream
`gs1/GS1_DigitalLink_Resolver_CE` — re-vendoring a future upstream version means re-applying (or
re-verifying already-fixed) these three patches; each is small, self-contained, and commented
in-place with a `# Fix:`-style note explaining why, to make that easy.

### 2026-09-02 — Auth Service derives the JWT subject from the chain, never from client input
**What:** `POST /auth/verify-sbt` originally took `subject` as a request field and put it straight
into the JWT's `sub` claim. Changed to always fetch the SBT's actual on-chain `owner` from the
orchestrator and use that — the `subject` field was removed from the request shape entirely.
**Why:** Trusting a client-supplied subject defeats the entire point of gating issuance on-chain —
anyone could have requested a valid, correctly-signed JWT claiming to be any wallet address, since
nothing checked that the caller *was* that wallet. Deriving `sub` from `ownerOf()` on the actual
minted token closes that gap for free, since the orchestrator call was already happening for the
active-status check.
**Alternatives considered:** Requiring a signed proof-of-wallet-ownership from the client (real
fix for a production system where the "device" and "resolver-issued redirect" aren't the same
trust boundary) — out of scope for local MVP; noted here so it isn't mistaken for solved.

### 2026-09-02 — `role`/`course_permissions` come from a server-side lookup, not the resolver link or client
**What:** `GET /sso/login/:gtin` looks up `role`/`coursePermissions` from a small in-memory
`ENROLLMENT_BY_PROGRAM` map in `auth-service`, rather than accepting them as query parameters.
**Why:** These are enrollment facts (what courses is this student actually in?), and the resolver
link — or any request — is not an authoritative source for them; a real deployment would look this
up from a student information system. Hardcoding a stand-in map is honest about "not built yet"
without inventing a fake persistence layer, and closes another spoofing vector (nothing stopped a
crafted request from claiming `role=admin` before this change).
**Alternatives considered:** Pass role/permissions through the resolver link's query string
(rejected — untrusted input, and collides with the query-append bug above); build a real
enrollment table in Postgres (deferred — first real persistence work, tracked in PLAN.md).

### 2026-09-02 — Compliance findings not fixed: GDPR pseudonymization, JSON-LD vocabulary purity
**What (GDPR, HLD §7):** The contract's on-chain state never stores anything beyond `gtin`/`serial`
(organizational identifiers) and a wallet address (already pseudonymous), satisfying the letter of
"pseudonymized identifiers on-chain." But the IPFS-pinned metadata — public, permanent,
content-addressed — routinely contains a real name (`"Maya Lindqvist"`). That's a real person's PII
sitting on a public, undeletable store, which is a GDPR-relevant gap the HLD's on-chain-only
framing doesn't cover. Not fixed: doing so properly means either encrypting/gating metadata access
or establishing a policy against real names in public passports, both bigger than this pass.
**What (JSON-LD, HLD §7):** Pinned metadata declares `"@context": "https://schema.org"` and a real
Schema.org `@type` (`Product`/`Person`), but layers custom properties (`ethicalClaims`,
`supplyChain`, `assembly`) that aren't defined by Schema.org or GS1 Web Vocabulary — they're just
extra keys under the schema.org context with no term definition. Functionally harmless (nothing
here does strict JSON-LD term expansion), but not a literal reading of "must inherit from
Schema.org and GS1 Web Vocabulary." A real fix would define a proper extended `@context` mapping
each custom term to an IRI.
**Why documented instead of fixed:** Both are real, worth flagging loudly rather than silently
working around, but neither blocks the local MVP from demonstrating the HLD's functional
requirements — they're posture/compliance debt, tracked here and in PLAN.md so they don't get
forgotten.

### 2026-09-02 — Achievements are an on-chain append-only claims registry, not IPFS metadata edits
**What:** Added `addClaim(tokenId, label, value)` / `getClaims(tokenId)` to `SoulboundToken.sol`, storing
a growing array per token, each entry timestamped on write. This is separate from the base
`tokenURI` metadata blob pinned at mint time.
**Why:** The student use case needs to add information *after* a credential is minted (volunteer
hours, certifications) without losing history. Overwriting the IPFS JSON each time would either
lose prior state or require re-pinning a growing blob on every update. An on-chain log is
tamper-evident by construction (fits "soulbound" ethos) and cheap to append to on a local/L2 chain.
**Alternatives considered:** Versioned IPFS blobs (rejected — loses atomicity, more IPFS traffic);
an off-chain database table (rejected for now — would need its own trust story; on-chain is free
integrity here since minting already requires a chain write).

### 2026-09-02 — Kept `gtin`/`serial` field names when pivoting from products to students
**What:** The contract, ABI, orchestrator routes, and shared types still use `gtin`/`serial`
internally. UI copy relabels them ("Program code" / "Student ID") but the wire format didn't change.
**Why:** Renaming across the contract (would require redeploying + retesting), every service, and
the shared types package is pure churn with no functional benefit — GS1's Digital Link URI shape
(two-part identifier + resolver) is exactly what's needed for "scan a physical thing, resolve to a
record," regardless of whether the "thing" is a product or a person. Keeping the schema stable
also means the GS1 resolver (vendored, not ours to modify) keeps working unchanged.
**Alternatives considered:** Full rename to `programCode`/`studentId` throughout (rejected —
touches ~15 files for a cosmetic win); introducing a generic `orgId`/`memberId` pair as a new
schema alongside the old one (rejected — two schemas to maintain for one MVP is worse than one
slightly-misnamed one).

### 2026-09-02 — Moved the project from an ad hoc folder into the `seed` template's structure
**What:** Copied the working system out of an unstructured project directory into a fresh repo
based on `github.com/LumosDhia/seed`, git history detached per that template's own README.
**Why:** Asked for by name; the seed template's CLAUDE.md/PLAN.md/STANDARDS.md/DECISIONS.md
structure is a better fit for a project meant to be picked up across multiple sessions than the
single-README approach used before.
**Alternatives considered:** None — direct instruction.
