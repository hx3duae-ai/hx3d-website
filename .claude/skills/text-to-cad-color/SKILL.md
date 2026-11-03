---
name: text-to-cad-color
description: >
  Turns a natural-language part description into a MULTI-COLOR printable 3D
  model: per-color STLs (Tier 1) plus a colored 3MF (Tier 2) for Bambu
  Studio / AMS printing. Use this skill whenever the user wants a part with
  multiple colors, two-tone or color-region designs, colored text/logos on a
  part, a 3MF with colors, or mentions AMS/multi-filament printing — e.g.
  "rook with red merlons", "black bracket with white lettering", "two-color
  print". For single-color parts use the text-to-cad skill instead.
---

# Text-to-CAD Color Skill (multi-color fork)

Independent fork of `text-to-cad` for multi-color parts. Same pipeline and
discipline; the difference is that the part is split into **color regions**
(one watertight body per color) and exported as per-region STLs + a colored
3MF. Do not modify or depend on the original `text-to-cad` folder.

## Skill files

> **`<SKILL_DIR>`** in this document means the absolute path of this skill's folder (the directory containing this SKILL.md). Substitute the real path when generating part scripts and commands.

- `cad_helpers.py` — safe ops (safe_cut / safe_fuse / safe_fillet / safe_chamfer / measure) + `finalize_parts()` multi-region export
- `export_3mf.py` — standalone STLs → colored 3MF (lib3mf); `--verify` reads back
- `qa_check.py` — per-region mesh QA (use `--components N` per region)
- `render_preview.py` — 4-view PNG with regions in their colors (opt-in read)
- `build123d_reference.md` — **READ BEFORE WRITING ANY PART SCRIPT** (incl.
  the Color Regions section)

Requires `pip install build123d trimesh matplotlib` (lib3mf ships with
build123d). Max 4 colors on a Bambu AMS lite.

## Workflow

Same six stages as text-to-cad, with these color-specific changes:

### Stage 1 — Design brief (+ color plan)

Add a color-region table: region name → color (hex + filament color name) →
which features belong to it → expected solid count per region. Regions are
defined by geometry (a split plane or feature boundary) — colors follow
solids, so every color boundary must be a geometric boundary. Prefer
height-separated regions when possible (fewer per-layer color changes =
less purge waste on a single-nozzle printer).

### Stage 2 — Part script

Build the COMPLETE part first as one solid (same rules as text-to-cad),
then split it into regions (see Color Regions in the reference doc), then:

```python
finalize_parts({
    "body":    (lower,   "#1a1a1a"),   # region -> (solid, hex color)
    "merlons": (merlons, "#cc2222"),
}, "<part-name>", out_dir=r"cad_out")
```

`finalize_parts` exports `<name>-<region>.stl` per region, `<name>.3mf`
(colored), `<name>.step` (colored assembly, best effort), and the report —
including pairwise region-overlap volumes (must be ~0).

### Stage 3 — Execute

Run the script; treat `MISSED_CUT`, `OVERLAP`, `*_FAILED` in issues as
failures. `3MF_EXPORT_FAILED` fails Tier 2 — fix it, don't ship STLs alone
unless the user only wants Tier 1.

### Stage 4 — QA (per region + assembly)

Run `qa_check.py` on EACH region STL with that region's expected dims and
`--components` (a region may be several disconnected solids, e.g. 6 merlon
teeth). Then verify from the report: assembly bbox matches the brief, all
pairwise overlaps ≤ 0.01 mm³. Verify the 3MF:

```bash
python "<SKILL_DIR>\export_3mf.py" --verify "cad_out\<part-name>.3mf"
```

### Stage 4.5 — Visual check (OPT-IN — ALWAYS ASK FIRST)

Same cost gate as text-to-cad: never render-and-READ without asking.
Rendering the PNG and *sending it to the user* is cheap and usually wanted
for color parts (the user checks the color plan visually); a vision READ by
Claude plus judge→tweak loops costs tokens — ask first, max 3 iterations.

```bash
python "...\render_preview.py" --out "cad_out\<name>_views.png" --part "cad_out\<name>-body.stl=#1a1a1a" --part "cad_out\<name>-merlons.stl=#cc2222"
```

### Stage 5 — Iterate

Same as text-to-cad; 3 strikes per failing check, then show the user.

### Stage 6 — Deliver (Bambu Studio instructions)

Tell the user both import paths:

- **Tier 2 (preferred):** open `<name>.3mf` in Bambu Studio — parts arrive
  colored; confirm the color → filament mapping and print.
- **Tier 1 (fallback):** drag ALL region STLs in together; answer **Yes** to
  "load these as a single object with multiple parts"; click each part and
  assign its filament.

Remind: single-nozzle color changes create purge waste; height-separated
color regions are the cheap kind.

## Session hygiene

Same as text-to-cad: fresh session per complex part or batch; all state
lives in the `.py` script + report JSONs on disk.
