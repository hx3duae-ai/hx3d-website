"""Mesh/solid helpers: shapely <-> trimesh, manifold booleans, Part container."""
from __future__ import annotations
from dataclasses import dataclass, field
import numpy as np
import trimesh
from shapely.geometry import Polygon, MultiPolygon, Point, box as sbox
from shapely.ops import unary_union


@dataclass
class Part:
    name: str
    mesh: trimesh.Trimesh
    color: str = "#cccccc"
    group: str = "main"
    kind: str = "solid"            # solid | support | note
    step_shape: object = None      # build123d shape when a true B-rep exists
    meta: dict = field(default_factory=dict)


def polys(g):
    if g is None or g.is_empty: return []
    if isinstance(g, Polygon): return [g]
    if isinstance(g, MultiPolygon): return list(g.geoms)
    return [x for x in getattr(g, "geoms", []) if isinstance(x, Polygon)]


def extrude(g, z0: float, z1: float) -> trimesh.Trimesh:
    """Extrude shapely geometry (holes kept) from z0 to z1 using manifold's robust cross-section extrusion."""
    import shapely, manifold3d as mf
    if g is None or g.is_empty: return trimesh.Trimesh()
    g = shapely.set_precision(g, 0.001)
    rings = []
    for p in polys(g):
        if p.area < 1e-6: continue
        rings.append(np.array(p.exterior.coords)[:-1])
        rings += [np.array(i.coords)[:-1] for i in p.interiors]
    if not rings: return trimesh.Trimesh()
    cs = mf.CrossSection(rings, mf.FillRule.EvenOdd)
    mesh = mf.Manifold.extrude(cs, float(z1 - z0)).to_mesh()
    m = trimesh.Trimesh(np.asarray(mesh.vert_properties)[:, :3].copy(), np.asarray(mesh.tri_verts), process=False)
    m.apply_translation([0, 0, z0])
    return m


def union(ms):
    ms = [m for m in ms if len(m.faces)]
    if not ms: return trimesh.Trimesh()
    if len(ms) == 1: return ms[0]
    return trimesh.boolean.union(ms, engine="manifold")


def diff(a, b):
    if not len(a.faces) or not len(b.faces): return a
    return trimesh.boolean.difference([a, b], engine="manifold")


def inter(a, b):
    if not len(a.faces) or not len(b.faces): return trimesh.Trimesh()
    return trimesh.boolean.intersection([a, b], engine="manifold")


def circle(cx, cy, r, n=48):
    return Point(cx, cy).buffer(r, quad_segs=n // 4)


def rrect(cx, cy, w, h, r=0.0, angle=0.0):
    p = sbox(cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2)
    if r > 0: p = p.buffer(-r).buffer(r, quad_segs=8) if min(w, h) > 2 * r else p
    if angle:
        from shapely import affinity
        p = affinity.rotate(p, angle, origin=(cx, cy))
    return p


def clean(m: trimesh.Trimesh) -> trimesh.Trimesh:
    m = m.copy(); m.merge_vertices(); m.update_faces(m.nondegenerate_faces()); m.remove_unreferenced_vertices(); m.fix_normals()
    return m


def bounds_size(parts):
    v = np.vstack([p.mesh.vertices for p in parts if len(p.mesh.vertices)])
    return v.min(0), v.max(0)
