#!/usr/bin/env bash
# Auto-handoff for HX 3D sessions.
#   save  (PreCompact)   → writes .claude/handoff/latest.md
#   load  (SessionStart) → prints it so it is re-injected after compaction/resume
set -u
ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
DIR="$ROOT/.claude/handoff"
FILE="$DIR/latest.md"

case "${1:-}" in
  save)
    mkdir -p "$DIR"
    {
      echo "# HX 3D — Handoff ($(date -u +%Y-%m-%dT%H:%MZ))"
      echo
      echo "## Git"
      echo "- Branch: $(git -C "$ROOT" branch --show-current 2>/dev/null)"
      echo '```'
      git -C "$ROOT" status --short 2>/dev/null | head -40
      echo '```'
      echo "### Last commits"
      git -C "$ROOT" log --oneline -8 2>/dev/null | sed 's/^/- /'
      ACT="$ROOT/hx-os/data/activity.json"
      if [ -f "$ACT" ] && command -v jq >/dev/null; then
        echo
        echo "## Recent HX OS activity"
        jq -r '.[0:10][] | "- \(.at[0:16]) [\(.module)] \(.text)"' "$ACT" 2>/dev/null
      fi
      echo
      echo "## Reminders"
      echo "- Follow CLAUDE.md and the hx3d-style skill (black/white/#FF66B2, no yellow)."
      echo "- Never publish or DM on the founder's behalf without approval."
    } > "$FILE"
    echo '{"systemMessage":"Auto-handoff saved to .claude/handoff/latest.md"}'
    ;;
  load)
    [ -f "$FILE" ] || exit 0
    echo "Auto-handoff from before the context was compacted — continue from here:"
    echo
    cat "$FILE"
    ;;
esac
exit 0
