# Provenance

This directory is vendored from the GS1 Resolver Community Edition:

- Source: https://github.com/gs1/GS1_DigitalLink_Resolver_CE
- License: Apache-2.0 (see `LICENSE` in this directory)
- Fetched: 2026-09-02, shallow clone of the default branch (v3.0.0)

It is **not maintained by GS1** (see the disclaimer at the top of its own README) —
issues should be raised upstream, not against this project. It's used here for
the GS1 Digital Link resolution engine (HLD §2.1.2), run as its own Docker Compose
stack independent of this repo's root `docker-compose.yml` (see its README for
`docker compose up` instructions and its own `.env` setup).

**This is no longer an unmodified copy.** Three bugs found while actually running it
(2026-09-02 audit) are patched directly in `web_server/src/web_logic.py`,
`web_server/src/web_namespace.py`, and `data_entry_server/src/data_entry_logic.py` — see
`DECISIONS.md` at the repo root for the full root-cause writeup of each. This repo's copy
therefore diverges from `gs1/GS1_DigitalLink_Resolver_CE` upstream; if you re-vendor a newer
upstream version, check whether these three are still present and worth re-patching.
