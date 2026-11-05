#!/usr/bin/env python3
"""PreToolUse hook: AI agents (Claude, NAJM, the HX team agents) may not read or change
owner-only pricing data directly on disk. Pricing goes through the HX OS API, which only
accepts the owner. See PRICING-POLICY.md. Exit code 2 blocks the tool call."""
import json, re, sys

DATA = r"data[/\\][^\s'\"]*"
OWNER_ONLY = re.compile(DATA + r"(pricing|audit|clients)\.json")    # never read or written directly (clients.json holds owner prices)
PROTECTED = re.compile(DATA + r"(clients|quotes|pricing|audit)\.json")  # never written directly
WRITE_HINT = re.compile(r"(>|\btee\b|sed\s+-i|\bmv\b|\bcp\b|\brm\b|\bpython3?\b|\bnode\b|\bperl\b|truncate|\bdd\b)")

try:
    ev = json.load(sys.stdin)
except Exception:
    sys.exit(0)
tool, inp = ev.get("tool_name", ""), ev.get("tool_input", {}) or {}
msg = ("BLOCKED by HX 3D owner-only pricing policy: only the owner calculates, edits or approves prices, "
       "through the HX OS pricing API. AI agents must not read or modify pricing data. Ask the owner instead.")

if tool in ("Edit", "Write", "MultiEdit", "NotebookEdit"):
    p = str(inp.get("file_path") or inp.get("notebook_path") or "")
    if PROTECTED.search(p):
        print(msg, file=sys.stderr); sys.exit(2)
elif tool == "Read":
    p = str(inp.get("file_path") or "")
    if OWNER_ONLY.search(p):
        print(msg, file=sys.stderr); sys.exit(2)
elif tool == "Bash":
    cmd = str(inp.get("command") or "")
    if OWNER_ONLY.search(cmd) or (PROTECTED.search(cmd) and WRITE_HINT.search(cmd)) or re.search(r"/api/quotes/[^/\s]+/(pricing|decision|send)|/api/audit", cmd):
        print(msg, file=sys.stderr); sys.exit(2)
sys.exit(0)
