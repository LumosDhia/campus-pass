#!/usr/bin/env bash
# SessionStart hook: injects PLAN.md into context automatically at the start
# of every session, as a forcing function on top of CLAUDE.md pointing at it.
set -euo pipefail
cd "${CLAUDE_PROJECT_DIR:-.}"

PLAN_CONTENT="(no PLAN.md found in project root — create one from the template)"
if [ -f PLAN.md ]; then
    PLAN_CONTENT=$(cat PLAN.md)
fi

python3 -c '
import json, sys
context = "## Current plan (auto-loaded from PLAN.md)\n\n" + sys.argv[1]
print(json.dumps({"hookSpecificOutput": {"hookEventName": "SessionStart", "additionalContext": context}}))
' "$PLAN_CONTENT"
