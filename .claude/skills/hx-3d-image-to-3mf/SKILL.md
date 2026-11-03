---
name: HX-3D-Image-to-3MF
description: Turns ONE reference image of a character or toy into a verified, multicolour, articulated (print-in-place) Bambu Studio 3MF for a Bambu Lab P2S + AMS, with STL, preview render, PDF assembly instructions and a print report. Use when the user gives an image of a character/toy/figure/mascot and wants it 3D printed, "image to 3MF", "print this character", articulated/poseable figure, or multicolour AMS print from a picture.
---

# HX-3D-Image-to-3MF

Input: one image. Output (in `OUT/deliverables/`): `model.3mf`, `model.stl`, `preview.png`,
`assembly_instructions.pdf`, `print_report.txt`.

`SKILL_DIR` = this folder. Scripts live in `SKILL_DIR/scripts`. Python needs:
`pip install build123d trimesh manifold3d scipy rtree shapely matplotlib scikit-learn reportlab pillow lib3mf`.

## Non-negotiable rules
1. **Never claim exact reconstruction.** One image shows one side. Back, sides, underside, depth,
   hands/feet and internal structure are *inferred*. Say so to the user, in `reconstruction.json`,
   and in every deliverable. Use words like "plausible", "inferred". If the image is too ambiguous
   (heavy perspective, occluded limbs, no face visible, photo of a real object with unclear parts),
   say what can't be determined and ask for more views instead of inventing detail.
2. **Never deliver an unverified 3MF.** `export_bambu_3mf.py` refuses unless verify.json passed for the
   *current* geometry hash, a matching preview exists, and `--preview-reviewed` is passed. Never bypass
   the gate, edit verify.json, or loosen a check to make it pass; fix the model.
3. Tell the user plainly what was NOT done: Bambu Studio was not opened, nothing was test-printed.
4. Colours come from the image's measured palette; do not "improve" them silently.

## Backends (be honest about availability)
- **AssetFurnace** (image-to-3D + rigging): its public interface could not be found when this skill was
  built, so no protocol is assumed. `scripts/af_adapter.py` runs whatever command the user sets in
  `HX_I23D_CMD` (template with `{image}` and `{out_dir}`; must write `mesh.glb|obj|stl|ply`, optionally
  `rig.json`). If unset/failing it reports `unavailable` — say that to the user; never claim AssetFurnace was used.
  The returned mesh is only a proportion/shape guide; the printable model is always rebuilt as clean
  parametric parts. Ask the user for the AssetFurnace CLI/API details to wire it up properly.
- **Claude-To-Print** (CAD + articulation): use the installed `text-to-cad-color` / `text-to-cad` skills'
  conventions (build123d, UPPER_CASE constants, `build123d_reference.md`, fillet-last, overshoot cuts)
  when writing the model script. Their `export_3mf.py` is a generic coloured 3MF; this skill's exporter
  adds Bambu per-part filament metadata and the safety gate.
- Fallback when no backend: you (Claude, with vision) reconstruct from the image directly.

## Workflow
Work in `OUT/` (e.g. `./hx_out/<name>/`).

1. **Analyse** — view the image yourself, then
   `python SKILL_DIR/scripts/pipeline.py analyse REF.png OUT` → `palette.json` (colours, area, normalized
   bboxes, silhouette aspect), `quantized.png`, `silhouette.png`, `backend_report.json`.
   Look at `quantized.png` to confirm colour boundaries. Backgrounds close to a foreground colour
   (ΔE<14) get eaten — recheck with `--bg-tol` if a light part vanished. Merge sub-0.4% specks consciously.
2. **Write `reconstruction.json`** in OUT:
   `{"exact_reconstruction_claimed": false, "confidence": "low|medium|high + why",
     "observed": [...], "inferred": [...], "unknown": [...]}` — be specific and honest.
3. **Design** (state a brief with numbers before coding): overall height (ask or default 100 mm, must fit the
   256 mm P2S volume with margin), proportions from the silhouette bbox (head:torso:legs ratios measured in
   pixels, scaled), part list, colours → AMS slots, joint list.
4. **Write `OUT/model.py`** from `examples/demo_robot.py`. Contract in `scripts/hx_lib.py`:
   - groups named `head`, `torso`, `left_arm`, `right_arm`, `left_leg`, `right_leg` (+ extras: tail, ears…)
   - each colour region = its own `part` (same group; parts must tile, never overlap; pocket the base
     and fill with the colour insert so boundaries match the image)
   - joints via `captive_pin(...)` (print-in-place captive disc + bore, 0.35 mm clearance) or your own
     hinge/ball design; declare `origin`, unit `axis`, `range_deg`. Leave `gap` air between limb and body.
   - print pose Z-up, resting on Z=0, no floating parts, details ≥0.8 mm (≥0.4 mm for engraved/inlaid colour).
5. **Verify** — `pipeline.py check MODEL OUT`. Checks: watertight/manifold, degenerate faces, same-group
   overlap, cross-group collisions, joint clearance ≥0.25 mm, full joint-range sweep (every 5°) for overlap
   and ≥0.1 mm gap, group connectivity, build volume, bed contact, wall thickness, overhang %, honesty
   record. Fix failures in `model.py` and repeat. Warnings must be reported to the user.
6. **Preview** — `pipeline.py preview MODEL OUT --ref REF.png`, then **Read `OUT/preview.png`** and compare it
   with the reference: silhouette, proportions, face, colour boundaries, joints at min/max pose. Iterate on
   mismatch. List honest differences for the user.
7. **Export** — `pipeline.py export MODEL OUT --preview-reviewed` (only after step 6). It re-reads the 3MF with
   lib3mf and checks object/triangle counts.
8. **Docs + package** — `pipeline.py docs MODEL OUT --ref REF.png` → PDF + report + `deliverables/`.
   (`pipeline.py all MODEL OUT --ref REF.png --preview-reviewed` does 5-8 in one go, stopping on first failure.)
9. **Report to the user**: deliverable paths, colour→AMS slot table, verify summary + every warning, what is
   inferred/unknown, and the caveats (not opened in Bambu Studio, not test-printed, clearances unproven,
   P2S build volume 256³ is an assumption in `hx_lib.PRINTER` to confirm, printer/filament presets must be
   picked in Bambu Studio).

## Known limits (state them when relevant)
- The 3MF uses Bambu Studio's multi-part object layout (component per colour part + `extruder` metadata) but was
  validated only by re-reading with lib3mf, not by Bambu Studio.
- Collision/clearance numbers are sampled estimates (±0.05 mm), not slicer-level analysis. Revolute joints only;
  ball joints/sliding need custom checks.
- Many small colour regions mean a long, wasteful AMS print; suggest merging regions if >6 colours or tiny details.
- Organic/soft characters become stylised block/primitive geometry unless a mesh backend supplies shapes to
  build from; fidelity is limited by what you can model parametrically.
