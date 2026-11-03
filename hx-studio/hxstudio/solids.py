"""Feature-list CSG realised twice: as a manifold mesh (STL/3MF/preview) and as a build123d B-rep (STEP).

feature = dict(shape=('poly', shapely) | ('circle', cx, cy, r), z0, z1, mode='add'|'cut')
        | dict(plane=(origin(3), normal(3)), mode='cut_above')   # removes the half-space n.(p-o) > 0
"""
from __future__ import annotations
import trimesh
from .meshutil import extrude, union, diff, circle, polys


def poly(g, z0, z1, mode="add"): return {"shape": ("poly", g), "z0": z0, "z1": z1, "mode": mode}
def cyl(cx, cy, r, z0, z1, mode="add"): return {"shape": ("circle", cx, cy, r), "z0": z0, "z1": z1, "mode": mode}
def cut_above(origin, normal): return {"plane": (tuple(origin), tuple(normal)), "mode": "cut_above"}


def to_mesh(features) -> trimesh.Trimesh:
    acc = trimesh.Trimesh()
    for f in features:
        if f["mode"] == "cut_above":
            o, n = f["plane"]; acc = acc.slice_plane(o, [-x for x in n], cap=True); continue
        g = f["shape"][1] if f["shape"][0] == "poly" else circle(*f["shape"][1:])
        m = extrude(g, f["z0"], f["z1"])
        if f["mode"] == "add": acc = union([acc, m]) if len(acc.faces) else m
        else: acc = diff(acc, m)
    return acc


def to_step(features):
    """B-rep via build123d. Circles are true circles, polygons are exact straight-edged faces."""
    from build123d import Face, Wire, Polyline, Cylinder, Pos, Plane, split, Keep, Solid, extrude as bextrude
    def face_of(p):
        outer = Wire(Polyline(*[(x, y, 0) for x, y in list(p.exterior.coords)[:-1]], close=True))
        inner = [Wire(Polyline(*[(x, y, 0) for x, y in list(i.coords)[:-1]], close=True)) for i in p.interiors]
        return Face(outer, inner)
    acc = None
    for f in features:
        if f["mode"] == "cut_above":
            o, n = f["plane"]; acc = split(acc, bisect_by=Plane(origin=o, z_dir=n), keep=Keep.BOTTOM); continue
        z0, z1 = f["z0"], f["z1"]
        if f["shape"][0] == "circle":
            _, cx, cy, r = f["shape"]; s = Pos(cx, cy, (z0 + z1) / 2) * Cylinder(r, z1 - z0)
        else:
            parts = [bextrude(Pos(0, 0, z0) * face_of(p), amount=z1 - z0) for p in polys(f["shape"][1]) if p.area > 1e-6]
            s = parts[0]
            for q in parts[1:]: s = s + q
        acc = s if acc is None else (acc + s if f["mode"] == "add" else acc - s)
    return acc
