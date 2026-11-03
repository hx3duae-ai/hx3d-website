---
name: text-to-cad
description: >
  Turns a natural-language part description into a printable 3D CAD model
  (STEP + STL) using build123d, with an automated QA loop. Use this skill
  whenever the user wants to design, generate, or modify a 3D-printable part,
  mechanical component, bracket, mount, enclosure, adapter, or any solid CAD
  model from a text description — including phrases like "design a part",
  "make me an STL", "generate a CAD model", "text to CAD", "3D print a
  bracket", or "model this part". Also trigger for edits to previously
  generated parts ("make the holes bigger", "add a fillet").
---

# Text-to-CAD Skill

Generates parametric, printable CAD models (STEP + STL) from natural-language
descriptions. Claude plays all design roles directly; deterministic Python
scripts handle geometry execution and QA. Workflow adapted from the
MIT-licensed Multi-Agent-CAD project (Pan-Chera/Multi-Agent-CAD).

## Skill files

> **`<SKILL_DIR>`** in this document means the absolute path of this skill's folder (the directory containing this SKILL.md). Substitute the real path when generating part scripts and commands.

- `cad_helpers.py` — safe_cut / safe_fuse / safe_fillet / safe_chamfer / measure / finalize
- `qa_check.py` — mesh QA on the exported STL (watertight, dims, body count)
- `render_preview.py` — 4-view PNG render for the opt-in visual check (Stage 4.5)
- `build123d_reference.md` — **READ THIS BEFORE WRITING ANY PART SCRIPT.**
  Authoritative build123d API rules; most geometry bugs come from ignoring it.

Requires `pip install build123d trimesh`.

## Workflow

Run these stages in order. Output goes to `cad_out\` under the current
working directory.

### Stage 1 — Design brief

Restate the request as an explicit brief before writing code:

- Part name (kebab-case, used for filenames)
- Overall bounding dimensions X × Y × Z (mm)
- Feature list: every plate, wall, lug, rib, hole, fillet with its dimensions
- **Verification targets**: expected overall dims, expected hole diameters and
  positions, expected body count (normally 1)
- Printing considerations if relevant (orientation, overhangs, wall thickness
  ≥ 1.2mm, hole clearances: M3→3.4mm, M4→4.5mm, M5→5.5mm)

Convention: origin at the centroid of the base footprint, Z=0 at the bottom,
Z up. **Show the arithmetic for every derived coordinate** (e.g.
`hole_x = 120/2 - 10 = 50.0`) — never hardcode an unexplained number.
If the user's request is ambiguous about a load-bearing dimension, ask;
otherwise pick sensible defaults and state them.

### Stage 2 — Part script

Read `build123d_reference.md` (in this skill's folder), then write
`cad_out\<part-name>.py`:

```python
import sys
sys.path.insert(0, r"<SKILL_DIR>")
from build123d import *
from cad_helpers import safe_cut, safe_fuse, safe_fillet, safe_chamfer, measure, finalize

# --- Parameters (ALL dimensions as UPPER_CASE constants) ---
BASE_W = 120.0
...

# --- Build (algebra API only, ordering: additive → subtractive → finishing) ---
body = extrude(Rectangle(BASE_W, BASE_D), amount=BASE_T)
measure(body, "base", "base")           # measure features BEFORE unioning
...
body = safe_fuse(body, boss, "boss-1")  # any non-trivial union (swept/helical/complex tools)
body = safe_cut(body, tool, "hole-1")   # never `body - tool`
...
body = safe_fillet(body, body.edges().filter_by(Plane.XY), 2.0, "perimeter")

if __name__ == "__main__":
    finalize(body, "<part-name>", out_dir=r"cad_out")
```

Hard rules (details and rationale in the reference doc):

1. Additive ops → subtractive ops → finishing ops (fillet/chamfer LAST)
2. Cut tools overshoot ≥2mm past both faces; `Align.MIN` on Z for Z-holes
3. `mirror()` for symmetric features, never hand-mirrored coordinates
4. Features must overlap the base volume, not just touch it
5. Headless: no viewers, no `.show()`

### Stage 3 — Execute

```bash
python "cad_out\<part-name>.py"
```

The script prints a JSON build report (bbox, volume, validity, per-feature
measurements, and issues). **Treat any `MISSED_CUT`, `*_FAILED`, or
`*_PARTIAL` entry in `issues` as a failure** — fix the script and re-run.
`*_DEGRADED` fillet entries mean the requested radius was too big; reduce the
constant to the radius that succeeded.

### Stage 4 — QA

```bash
python "<SKILL_DIR>\qa_check.py" "cad_out\<part-name>.stl" --expect-x <X> --expect-y <Y> --expect-z <Z> --tol 0.5
```

Pass the Stage-1 verification targets. Exit code 1 = failure; the JSON output
says which check failed. Also cross-check the Stage-3 report yourself:
per-feature `measurements` vs the brief (hole positions, feature sizes) —
the mesh QA can't see individual features once they're merged.

### Stage 4.5 — Visual check (OPT-IN — ALWAYS ASK FIRST)

`render_preview.py` renders 4 shaded views (iso/front/side/top) of the STL
into one PNG; reading that PNG with vision verifies the part *looks* right —
the only check that catches aesthetic errors mesh QA can't see.

**Cost gate: never render-and-read automatically.** Rendering is free, but
each vision read of the PNG costs tokens, and a judge→tweak→re-render loop
multiplies that. Rules:

1. After mesh QA passes, ASK the user whether they want a visual check —
   do not start one unprompted. Skip the question only if the user already
   requested visual verification for this part, or declines it as standing
   preference.
2. Expect "no" for simple functional parts (brackets, spacers, plates) —
   the user previews STLs in their slicer (e.g. Bambu Studio) anyway.
   The loop earns its cost on sculptural/aesthetic parts.
3. When enabled: render → Read the PNG → judge against the brief's intended
   silhouette/proportions → tweak constants → re-run Stages 3–4.5.
   Hard limit: 3 visual iterations, then show the user the latest PNG.

```bash
python "<SKILL_DIR>\render_preview.py" "cad_out\<part-name>.stl"
```

### Stage 5 — Iterate

On any failure: diagnose from the report + QA JSON, fix `<part-name>.py`,
re-run Stages 3–4. Common fixes are in the reference doc's Common Mistakes
table. Limit: if the same check fails 3 times in a row, stop and show the
user the failing report instead of looping further.

### Stage 6 — Deliver

- Tell the user where the STEP and STL landed and the final measured
  dims/volume.
- If a Blender MCP connection is available (`mcp__blender__*` tools),
  offer to import the STL into Blender for visual inspection
  (`import_mesh.stl` via `execute_blender_code`).
- Keep the `.py` script — it is the parametric source; edits ("make the holes
  6mm") are one-constant changes followed by Stages 3–5.

## Session hygiene (usage-limit frugality)

Each QA iteration re-sends conversation history, so long sessions grow the
per-turn cost. The deterministic scripts keep artifacts small, but for:

- **complex parts** likely to need many QA loops, or
- **batches** of several parts in a row,

prefer a fresh session (or a subagent) per part so history stays short. All
state lives on disk — the `.py` script, `<part>_report.json`, and the QA
output — so a new session resumes a part by reading those files; nothing is
lost by splitting sessions. This mirrors the upstream Multi-Agent-CAD design,
where each stage starts with a clean context and only structured files pass
between stages.
