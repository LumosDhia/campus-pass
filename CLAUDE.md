# Project Context

This repo uses a small, purpose-specific set of files so every new session starts fully oriented without re-explaining the project:

- **PLAN.md** — current state: what's done, in progress, and next. Read this first.
- **STANDARDS.md** — project-specific conventions and constraints. Read this before writing or editing code.
- **DECISIONS.md** — a log of non-obvious technical/architectural decisions and why they were made. Check this before revisiting something that looks already-decided.

A SessionStart hook (`.claude/hooks/session-start.sh`) already injects PLAN.md's content automatically at the start of every session — you don't need to be asked to read it.

## Keeping this current

- When the plan changes, update PLAN.md directly — don't just say it out loud. `/plan-update` does this for you from the conversation so far.
- When you make a non-obvious technical or architectural call, log it to DECISIONS.md. `/decide "..."` does this in a consistent format.
- Run `/refresh` after a long session, or before/after compaction, to reload PLAN.md + STANDARDS.md + DECISIONS.md and re-orient.

## CampusPass

A local-only MVP: a non-transferable blockchain credential (Soulbound Token) per student, used
for passwordless SSO and as an append-only record of achievements. Reframed from an earlier
"Ethical Digital Product Passport" concept — see `docs-source-HLD.md` for the original spec and
`DECISIONS.md` for why the identifier shape (program code + student ID, still called
`gtin`/`serial` internally) was kept rather than renamed.

Read `README.md` for the full architecture and local run instructions before making changes —
it's kept in sync with what's actually built, unlike PLAN.md which tracks only what's in flight.
