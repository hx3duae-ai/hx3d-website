"""Stage 4: coloured preview renders -> OUT/preview.png (+ preview_meta.json bound to the model hash).

    python render_preview.py model.py OUT_DIR [--ref ref.png]
Panels: reference image, front, side, back, iso, and two joint-extreme poses.
"""
import argparse, json, sys
from pathlib import Path
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d.art3d import Poly3DCollection
from PIL import Image
from hx_lib import *


def draw(ax, meshes, colors, elev, azim, lim):
    light = np.array([0.4, -0.6, 0.7]); light /= np.linalg.norm(light)
    for n, m in meshes.items():
        tri = m.triangles
        shade = 0.72 + 0.28 * np.clip(m.face_normals @ light, 0, 1)
        base = np.array(hex_rgb(colors[n])) / 255.0
        fc = np.clip(base[None] * shade[:, None], 0, 1)
        pc = Poly3DCollection(tri, facecolors=fc, edgecolors="none", linewidths=0)
        ax.add_collection3d(pc)
    c, r = lim
    ax.set_xlim(c[0] - r, c[0] + r); ax.set_ylim(c[1] - r, c[1] + r); ax.set_zlim(c[2] - r, c[2] + r)
    ax.set_box_aspect((1, 1, 1)); ax.view_init(elev, azim); ax.set_axis_off()


def posed(spec, meshes, which):
    out = {n: m.copy() for n, m in meshes.items()}
    parts = {p["name"]: p["group"] for p in spec["parts"]}
    for j in spec.get("joints", []):
        ang = j["range_deg"][1 if which == "max" else 0]
        for n in out:
            if parts[n] in moving_groups(j):
                out[n] = rotate_mesh(out[n], j["origin"], j["axis"], float(ang))
    return out


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("model"); ap.add_argument("out"); ap.add_argument("--ref")
    a = ap.parse_args(); out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
    spec = load_model(a.model); meshes = meshes_from_spec(spec)
    colors = {p["name"]: p["color"] for p in spec["parts"]}
    allv = np.vstack([m.vertices for m in meshes.values()])
    c = (allv.min(0) + allv.max(0)) / 2; r = (allv.max(0) - allv.min(0)).max() / 2 * 1.05
    views = [("front", 0, -90), ("side", 0, 0), ("back", 0, 90), ("iso", 22, -50)]
    panels = []
    fig = plt.figure(figsize=(16, 9), dpi=110)
    ref = Path(a.ref) if a.ref else None
    ax = fig.add_subplot(2, 4, 1)
    if ref and ref.exists(): ax.imshow(Image.open(ref).convert("RGB")); ax.set_title("reference image (input)")
    ax.axis("off")
    for i, (t, el, az) in enumerate(views):
        ax = fig.add_subplot(2, 4, i + 2 if i < 3 else 5, projection="3d")
        draw(ax, meshes, colors, el, az, (c, r)); ax.set_title(t)
    for i, w in enumerate(("min", "max")):
        ax = fig.add_subplot(2, 4, 6 + i, projection="3d")
        draw(ax, posed(spec, meshes, w), colors, 22, -50, (c, r * 1.25)); ax.set_title(f"all joints at {w} limit")
    ax = fig.add_subplot(2, 4, 8); ax.axis("off")
    leg = ["%s  %s" % (hx, ", ".join(sorted({p['group'] for p in spec['parts'] if p['color'].lower() == hx}))) for hx in sorted({p["color"].lower() for p in spec["parts"]})]
    ax.text(0, 1, "colours (= filament slots)\n" + "\n".join(leg) + "\n\nRENDER OF THE MODEL, NOT A PHOTO.\nHidden sides are inferred.", va="top", fontsize=9, family="monospace")
    for i, hx in enumerate(sorted({p["color"].lower() for p in spec["parts"]})):
        ax.add_patch(plt.Rectangle((0.78, 0.85 - 0.075 * i - 0.04 * 0), 0.12, 0.05, color=hx, transform=ax.transAxes))
    fig.tight_layout(); fig.savefig(out / "preview.png"); plt.close(fig)
    (out / "preview_meta.json").write_text(json.dumps({"hash": mesh_hash(meshes, spec)}))
    print("wrote", out / "preview.png")

if __name__ == "__main__":
    main()
