"""Shared helpers for the HX-3D-Image-to-3MF skill.

A model script (model.py) must expose build() -> dict:

    {
      "parts":  [{"name": str, "group": str, "color": "#rrggbb", "shape": <build123d Shape>}, ...],
      "joints": [{"name": str, "parent": group, "child": group,
                  "origin": (x,y,z), "axis": (x,y,z), "range_deg": (lo, hi),
                  "moves": [groups that move with the child, default [child]],
                  "nominal_clearance": mm}],
      "fused":  [[groupA, groupB], ...]     # rigid contacts allowed between groups
    }

All units are millimetres. The model is authored in PRINT POSE: Z up, lowest point at Z=0.
`group` = one rigid body (head, torso, left_arm...). Several parts (colours) may share a group.
"""
from __future__ import annotations

import hashlib
import importlib.util
import json
import math
from pathlib import Path

import numpy as np
import trimesh

PRINTER = {
    "name": "Bambu Lab P2S",
    "build_volume_mm": [256, 256, 256],      # ASSUMPTION: confirm against Bambu's spec sheet
    "nozzle_mm": 0.4,
    "ams_slots_per_unit": 4,
    "usable_margin_mm": 5,
}
MIN_JOINT_CLEARANCE = 0.25   # mm, radial/axial gap for 0.4 nozzle print-in-place
MAX_JOINT_CLEARANCE = 0.8    # above this the joint is floppy
HARD_MIN_GAP = 0.10          # mm, below this during motion parts will fuse
OVERLAP_TOL_MM3 = 0.2


def load_model(path: str) -> dict:
    spec = importlib.util.spec_from_file_location("hx_model", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod.build()


def shape_to_mesh(shape, tol=0.03, ang=0.2) -> trimesh.Trimesh:
    verts, tris = shape.tessellate(tol, ang)
    v = np.array([(p.X, p.Y, p.Z) for p in verts], dtype=float)
    m = trimesh.Trimesh(vertices=v, faces=np.array(tris), process=True)
    m.merge_vertices()
    m.fix_normals()
    return m


def meshes_from_spec(spec: dict) -> dict:
    return {p["name"]: shape_to_mesh(p["shape"]) for p in spec["parts"]}


def mesh_hash(meshes: dict, spec: dict) -> str:
    h = hashlib.sha256()
    for name in sorted(meshes):
        m = meshes[name]
        h.update(name.encode())
        h.update(np.round(m.vertices, 3).tobytes())
        h.update(m.faces.tobytes())
    h.update(json.dumps(spec.get("joints", []), sort_keys=True, default=str).encode())
    return h.hexdigest()


def hex_rgb(h: str):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def captive_pin(origin, axis, pin_r=1.8, flange_r=3.0, flange_t=1.2, wall=1.6,
                gap=0.4, embed=2.0, clearance=0.35):
    """Print-in-place captive revolute pin (child pin, captured disc in parent pocket).

    Local frame: +Z = axis, pointing from the PARENT interior OUT toward the CHILD.
    `origin` is on the parent's outer surface where the pin leaves it.
    The child's mating face must sit at local z = gap (leave `gap` mm of air).
    Returns (pin_solid, parent_cut, info):
      pin_solid  -> union into the child part (it embeds `embed` mm into the child)
      parent_cut -> subtract from the parent part (bore + enclosed disc pocket)
    """
    from build123d import Axis, Cylinder, Location, Plane, Pos, Align

    c = clearance
    below = wall + flange_t                      # pin extends this far below the surface
    pin_len = below + gap + embed
    pin = Pos(0, 0, -below + pin_len / 2) * Cylinder(pin_r, pin_len)
    disc = Pos(0, 0, -below + flange_t / 2) * Cylinder(flange_r, flange_t)
    pin = pin + disc

    bore = Pos(0, 0, -wall / 2 + 0.01) * Cylinder(pin_r + c, wall + 0.2)
    pocket = Pos(0, 0, -below + flange_t / 2) * Cylinder(flange_r + c, flange_t + 2 * c)
    cut = bore + pocket

    plane = Plane(origin=tuple(origin), z_dir=tuple(axis))
    loc = Location(plane)
    info = {"radial_clearance": c, "axial_clearance": c, "gap": gap,
            "origin": tuple(origin), "axis": tuple(axis)}
    return loc * pin, loc * cut, info


def rotate_mesh(mesh, origin, axis, deg):
    T = trimesh.transformations.rotation_matrix(math.radians(deg), axis, origin)
    m = mesh.copy()
    m.apply_transform(T)
    return m


def moving_groups(joint) -> set:
    return set(joint.get("moves") or [joint["child"]])
