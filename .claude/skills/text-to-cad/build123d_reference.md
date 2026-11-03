# build123d Algebra API Reference (v0.11.x)

Authoritative API reference for part scripts written by the text-to-cad skill.
Adapted from the MIT-licensed Multi-Agent-CAD project
(https://github.com/Pan-Chera/Multi-Agent-CAD), with helper names updated to
this skill's `cad_helpers.py` (`safe_cut`, `safe_fuse`, `safe_fillet`, `safe_chamfer`).

Use the **algebra API only** — NO context managers (`BuildPart`, `BuildSketch`,
`Locations`). `BuildLine` is the one allowed context manager, for wireframes.

## Imports

```python
from build123d import *
```

## CRITICAL: Primitive Alignment

All primitives (`Cylinder`, `Box`, `Sphere`, `Cone`) default to
`align=(CENTER, CENTER, CENTER)` — the object is **centered at the origin**.

```python
Cylinder(radius=5, height=10)   # Z = -5 to +5  (centered!)
Box(10, 20, 30)                 # Z = -15 to +15 (centered!)
```

Use `align` to control which point of the bounding box sits at the origin:

```python
Cylinder(radius=5, height=10, align=(Align.CENTER, Align.CENTER, Align.MIN))
# Z = 0 to 10  (bottom at origin)
Box(10, 20, 30, align=(Align.CENTER, Align.CENTER, Align.MIN))
# Z = 0 to 30  (bottom at origin)
```

**For Z-axis through-hole cutting tools, use `Align.MIN` on Z** so
`Pos(x, y, z)` places the BOTTOM of the cylinder at Z=z:

```python
# Through-hole in Z through a 10mm base plate (Z=0..10)
tool = Pos(x, y, -2) * Cylinder(radius=3.5, height=14,
    align=(Align.CENTER, Align.CENTER, Align.MIN))
# Bottom Z=-2, top Z=12 → penetrates Z=0..10 with 2mm overshoot each side

# For Y/X-axis holes (rotated cylinders), keep DEFAULT alignment (CENTER):
tool = Pos(0, 0, 34) * Rot(X=90) * Cylinder(radius=7, height=60)
# Center at Z=34, Y range: -30..30 → covers lugs at Y=-26..26
```

## Pos and Rot Transforms

`Pos(x, y, z)` translates. `Rot(X=deg, Y=deg, Z=deg)` rotates.
**Order matters** — transforms apply right-to-left:

```python
Pos(0, 0, 34) * Rot(X=90) * Cylinder(radius=7, height=60)
# 1. Create cylinder (centered at origin, along Z)
# 2. Rot(X=90): rotate Z-axis to Y-axis
# 3. Pos(0,0,34): translate center to Z=34
```

## Sketch Primitives (top-level)

```python
Rectangle(width, height)
Circle(radius)
RegularPolygon(radius, sides)
SlotCenterLine(center_separation, radius)
Ellipse(width, height)
```

Use `Pos(x, y) * shape` to offset entities from origin.

## Wireframe → Face (custom profiles: gussets, ribs, wedges)

```python
with BuildLine(Plane.XZ) as wire:   # pick the right plane
    Polyline((0, 0), (10, 0), (0, 10), close=True)
face = make_face(wire.wire())       # ← pass wire.wire() result
solid = extrude(face, amount=THICKNESS)
```

For arcs use `ThreePointArc` / `RadiusArc` inside `BuildLine`.

## 3D Operations

```python
extrude(to_extrude, amount=10, dir=(0, 0, 1), both=False, taper=0)
revolve(profiles, axis=Axis.Z, revolution_arc=360)
```

- `extrude()` parameter is `dir`, NOT `direction`. `both=True` extrudes ±amount.
- `revolve()` parameter is `revolution_arc`, NOT `angle`.

## Sweep

`sweep(profile, path)` sweeps a 2D profile along a 3D path.

**The profile MUST be perpendicular to the path tangent at the start point.**
If the profile is parallel to the path, the result is a flat ribbon:

```python
helix_path = Helix(pitch=116, height=116, radius=66)

# ❌ WRONG: Circle in XY plane (parallel to helix tangent) → flat ribbon
sk = Pos(66, 0, 0) * Circle(2.5)

# ✅ CORRECT: Circle in XZ plane (perpendicular to helix tangent) → tube
sk = Plane.XZ * Pos(66, 0, 0) * Circle(2.5)
rail = sweep(sk, helix_path)
```

Rule: `Plane.XZ` or `Plane.YZ` for profiles swept along paths starting in the
XY plane; `Plane.XY` only when the path starts going vertically (along Z).

## Boolean Operations

```python
result = body_a + body_b                     # union of simple prisms
result = safe_fuse(body, tool, "boss-1")     # union of anything non-trivial
result = safe_cut(body, tool, "hole-1")      # cut — use instead of `body - tool`
result = body_a & body_b                     # intersect
```

- `safe_cut` detects missed cuts (no volume change) and records them in the report.
- `safe_fuse` detects a **silently failed union** — OpenCascade can return the
  body unchanged with no error (typical triggers: coplanar or tangent faces,
  swept/helical solids). It compares the volume gain with the tool's volume
  outside the body, retries without `clean()` and then with a fuzzy tolerance,
  and records `MISSED_FUSE` if the feature is really gone. Use it for every
  union whose tool is not a plain box/cylinder overlapping a plain body.
- **Cut tools MUST overshoot the target by ≥1–2mm on each side.**
  Coincident/coplanar faces cause OpenCascade kernel failures.
- Bodies that only touch at a face CANNOT be unioned — features must
  **overlap** the base volume (extend through it), not just touch it.
- **Silent failure is a real failure mode**: a valid `is_valid` solid with the
  right bbox can still be missing a feature. Volumes are the evidence —
  `measure()` features before merging and compare stage volumes.

## Threads (helical sweeps) — proven recipe

Learned on the 3/4"-5 ACME broom-handle socket (v1 shipped with 2 of 3
sockets smooth — the fuse dropped the ridge without a word):

1. **Cut, don't fuse.** Model the *mating* thread profile widened by the
   clearance (a "tap"), sweep it along a `Helix`, and `safe_cut` it out of a
   **solid** cylinder. Fusing a swept ridge into a bored wall fails silently.
2. **THE governing rule — the helical cutter must stay FULLY EMBEDDED in
   solid material.** If the swept tool crosses (or is tangent to) any
   boundary of the blank, the boolean fails silently and catastrophically:

   | cutter vs blank | what OCC does |
   |---|---|
   | fully embedded | correct groove ✅ |
   | exits the outer surface | **removes the ENTIRE blank** |
   | tangent to the outer surface | removes **nothing** |
   | inner edge opens into an existing bore | removes **nothing** |

   Consequences: **groove first, THEN bore** (the unbored blank is what
   embeds the tool), and to thread the *outside* of a shaft, cut on an
   oversized blank and trim to the major diameter afterwards
   (`(Cylinder(13,L) - space) & Cylinder(r_major,L)`). A tell-tale for this
   failure: `blank & cutter` returns 100% of the blank while the cutter's own
   volume is smaller — geometrically impossible, so the tool is being
   mis-evaluated.
3. **Form the groove past the mating thread's full length.** The sweep stops
   where its helix stops; beyond that is solid runout. A groove formed only
   to 21.9 mm jams a 22 mm male ~1.5 mm short of home while every mesh check
   still passes. Derive the depth from the mate (`THREAD_DEPTH = MALE_LEN + 4`)
   and assert it in the script rather than hardcoding.
4. Profile in the **radial plane** (`Plane.XZ * Polygon(..., align=None)` —
   `align=None` or the polygon re-centres itself), swept with
   `sweep(prof, path=helix, is_frenet=True)`; the cutter's inner edge sits
   ~0.4 mm inside the bore (in air) so it crosses the bore surface
   transversally; the `Helix` radius = the pitch radius (where the profile
   lives — sweeping on a distant path degrades the approximation).
5. **No tangencies**: a lead-in cone whose base radius equals the crest
   radius leaves a non-watertight sliver — start it inside the bore.
6. Fuse all simple prisms (blank, bar, ribs) FIRST while everything is
   analytic; do the helical cuts last.
7. **Verify the thread form from the mesh**, not the report: section the STL
   with an axial plane and measure crest/root radii, groove widths at the
   pitch radius, and pitch. `qa_check` dims/watertight/volume can all pass
   with the thread missing.
8. **Verify the MATE, not just the shape.** Build the mating part at nominal
   size, place it at full engagement, and check the intersection volume is
   zero; probe reachable depth with a plain cylinder (binary search on
   "intersection is empty"). This is the only check that catches a socket
   that is correct but too shallow. Cheap to build: the female groove was cut by a tool shaped like the male,
   so a zero-clearance version of that same cutter IS the nominal mating form.
9. `Helix(pitch, height, radius)` is right-hand by default (`lefthand=True`
   for LH). Standard 3/4"-5 ACME (US broom/mop/paint poles): major 19.05,
   pitch 5.08, 29° included flank, width at pitch line = P/2 = 2.54, minor
   ≈16.0 (stub depth). Female socket that fit: bore Ø16.8, root Ø20.0,
   0.15–0.35 mm axial clearance per flank (print a 3-socket coupon to pick).

## Mirror for Symmetric Parts

Generate ONLY one half and `mirror()` the other — re-generating mirrored
geometry from scratch causes coordinate sign errors:

```python
solid_right = Pos(0, 26, 0) * Rot(X=90) * extrude(sk_lug, amount=18.0)
solid_left = mirror(solid_right, about=Plane.XZ)
body = body + solid_right + solid_left
```

- `Plane.XZ` — mirrors Y → -Y (left/right)
- `Plane.YZ` — mirrors X → -X (front/back)
- `Plane.XY` — mirrors Z → -Z (top/bottom)

## Rib Perpendicularity

A rib's **sketch plane** MUST be **orthogonal** to the connection face plane.
Connection face on XZ → rib sketch on YZ; on YZ → rib on XZ; on XY → rib on
XZ or YZ. Do NOT fix a wrong-plane rib with Pos/Rot — switch the plane and
remap the local coordinates.

On XZ/YZ sketches the world Z-axis maps to the sketch's local **y**
coordinate — setting all local y=0 collapses the sketch into a line.

## Selecting Geometry

```python
solid.faces().sort_by(Axis.Z)[-1]   # top face
solid.faces().sort_by(Axis.Z)[0]    # bottom face
solid.edges().filter_by(Axis.Z)     # vertical edges
solid.edges().filter_by(Plane.XY)   # horizontal edges (top+bottom perimeter)
```

## Fillet and Chamfer

Fillets/chamfers MUST come AFTER all boolean operations — every boolean
invalidates edge selectors. Use `safe_fillet` / `safe_chamfer` (progressive
size degradation + per-GeomType fallback built in):

```python
# Base perimeter (horizontal edges at top/bottom)
solid = safe_fillet(solid, solid.edges().filter_by(Plane.XY), 3.0, "base-perimeter")

# Vertical edges split by position
z_edges = solid.edges().filter_by(Axis.Z)
outer = [e for e in z_edges if abs(e.center().X) > 20]
solid = safe_fillet(solid, outer, 2.0, "outer-verticals")
```

Key rules:

- `e.center().Z` (capital axis names), NOT `e.center().z`
- Filter by `e.length` to avoid tiny edges from holes/cuts
- Use SEMANTIC selectors (`filter_by`, length, position), not hardcoded
  bbox coordinates

## Export / Report

Handled by `finalize(solid, name, out_dir)` from `cad_helpers` — exports
STEP + STL and prints/writes the JSON build report.

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| `Pos(x,y,-1) * Cylinder(h=12)` → blind hole (center at -1) | Add `align=(CENTER,CENTER,MIN)` |
| `extrude(sk, direction=...)` | Parameter is `dir` |
| `with BuildPart():` | Algebra API only — top-level `extrude()`, `Box()`, etc. |
| `body - tool` | Use `safe_cut(body, tool, label)` |
| `body + swept_solid` (helical/complex tool) | `safe_fuse(...)`, or better: model it as a cut |
| Helical cutter after boring | Groove first, bore second |
| Fillet before boolean | Finishing operations LAST |
| `make_face(Line(...), Arc(...))` | `make_face(wire.wire())` with BuildLine |
| `sweep(Circle(r), helix)` → flat ribbon | Profile ⊥ path tangent: `Plane.XZ * Circle(r)` |
| Hand-writing mirrored geometry | `mirror(solid, about=Plane.XZ)` |
| `filter_by(Axis.Z)` for base perimeter fillet | `filter_by(Plane.XY)` for horizontal edges |
| `e.center().z` → AttributeError | `e.center().Z` |
| Features that only touch the base | Extend through the base so volumes overlap |
| Counterbore via fake params | Two overlapping cylinder cuts |
| `.show()` / viewer imports | Headless — never import viewers |
