"""Colored multi-object 3MF exporter (Tier 2) for the text-to-cad-color skill.

Combines one or more STLs into a single 3MF where each STL becomes a named
mesh object with an object-level color — Bambu Studio (and other slicers)
import the parts pre-colored, ready for filament mapping.

Standalone CLI (works on ANY STLs, not just this skill's output):

    python export_3mf.py out.3mf "body.stl=#1a1a1a" "merlons.stl=#cc2222"
    python export_3mf.py --verify out.3mf
"""

from __future__ import annotations

import json
import sys

import lib3mf
import trimesh


def _hex_to_rgb(hex_color: str) -> tuple[int, int, int]:
    h = hex_color.lstrip("#")
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)


def _get_wrapper():
    return lib3mf.get_wrapper()


def _make_color(wrapper, r: int, g: int, b: int):
    try:
        return wrapper.RGBAToColor(r, g, b, 255)
    except AttributeError:
        c = lib3mf.Color()
        c.Red, c.Green, c.Blue, c.Alpha = r, g, b, 255
        return c


def _identity_transform(wrapper):
    try:
        return wrapper.GetIdentityTransform()
    except AttributeError:
        tf = lib3mf.Transform()
        for i in range(4):
            for j in range(3):
                tf.Fields[i][j] = 1.0 if i == j else 0.0
        return tf


def write_3mf(entries, out_path: str) -> dict:
    """entries: iterable of (stl_path, hex_color, name). Returns summary dict."""
    wrapper = _get_wrapper()
    model = wrapper.CreateModel()
    try:
        model.SetUnit(lib3mf.ModelUnit.MilliMeter)
    except Exception:
        pass

    summary = {"file": out_path, "objects": []}
    for stl_path, hex_color, name in entries:
        m = trimesh.load(stl_path, force="mesh")

        mesh_obj = model.AddMeshObject()
        mesh_obj.SetName(name)

        vertices = []
        for v in m.vertices:
            p = lib3mf.Position()
            p.Coordinates[0] = float(v[0])
            p.Coordinates[1] = float(v[1])
            p.Coordinates[2] = float(v[2])
            vertices.append(p)
        triangles = []
        for f in m.faces:
            t = lib3mf.Triangle()
            t.Indices[0] = int(f[0])
            t.Indices[1] = int(f[1])
            t.Indices[2] = int(f[2])
            triangles.append(t)
        mesh_obj.SetGeometry(vertices, triangles)

        r, g, b = _hex_to_rgb(hex_color)
        color_group = model.AddColorGroup()
        prop_id = color_group.AddColor(_make_color(wrapper, r, g, b))
        mesh_obj.SetObjectLevelProperty(color_group.GetResourceID(), prop_id)

        model.AddBuildItem(mesh_obj, _identity_transform(wrapper))
        summary["objects"].append({
            "name": name,
            "color": hex_color,
            "vertices": len(m.vertices),
            "triangles": len(m.faces),
        })

    writer = model.QueryWriter("3mf")
    writer.WriteToFile(str(out_path))
    return summary


def verify_3mf(path: str) -> dict:
    """Read a 3MF back and report its objects — sanity check after export."""
    wrapper = _get_wrapper()
    model = wrapper.CreateModel()
    reader = model.QueryReader("3mf")
    reader.ReadFromFile(str(path))

    objects = []
    it = model.GetMeshObjects()
    while it.MoveNext():
        mo = it.GetCurrentMeshObject()
        objects.append({
            "name": mo.GetName(),
            "vertices": mo.GetVertexCount(),
            "triangles": mo.GetTriangleCount(),
        })
    return {"file": path, "object_count": len(objects), "objects": objects}


def main() -> int:
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        return 2

    if args[0] == "--verify":
        print(json.dumps(verify_3mf(args[1]), indent=2))
        return 0

    out_path = args[0]
    entries = []
    for spec in args[1:]:
        stl_path, _, hex_color = spec.rpartition("=")
        if not stl_path:
            print(json.dumps({"error": f"bad spec (want path=#rrggbb): {spec}"}))
            return 2
        name = stl_path.replace("\\", "/").rsplit("/", 1)[-1].rsplit(".", 1)[0]
        entries.append((stl_path, hex_color, name))

    summary = write_3mf(entries, out_path)
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
