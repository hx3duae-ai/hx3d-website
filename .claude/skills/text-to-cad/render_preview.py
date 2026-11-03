"""Multi-angle STL preview renderer for the text-to-cad skill.

Renders 4 shaded views (iso, front, side, top) of an STL into ONE PNG so a
single image read covers all angles. Rendering is cheap (local matplotlib);
READING the image with vision costs tokens — per SKILL.md, only render and
analyze when the user has opted into the visual loop.

Usage:
    python render_preview.py part.stl [--out part_views.png] [--size 900]
"""

from __future__ import annotations

import argparse
import json
import sys

import matplotlib

matplotlib.use("Agg")  # headless

import matplotlib.pyplot as plt
import numpy as np
import trimesh
from mpl_toolkits.mplot3d.art3d import Poly3DCollection

VIEWS = [
    ("isometric", 30, 45),
    ("front", 0, -90),
    ("side", 0, 0),
    ("top", 89.9, -90),
]


def main() -> int:
    ap = argparse.ArgumentParser(description="Render 4-view STL preview PNG")
    ap.add_argument("stl", help="Path to STL file")
    ap.add_argument("--out", help="Output PNG path (default: <stl>_views.png)")
    ap.add_argument("--size", type=int, default=900,
                    help="Approx PNG width/height in px (default 900)")
    args = ap.parse_args()

    out_path = args.out or args.stl.rsplit(".", 1)[0] + "_views.png"

    mesh = trimesh.load(args.stl, force="mesh")
    tris = mesh.triangles
    normals = mesh.face_normals

    # Simple fixed-direction lambert shading (fine for a preview)
    light = np.array([0.4, -0.7, 0.6])
    light /= np.linalg.norm(light)
    intensity = np.clip(normals @ light, 0.0, 1.0) * 0.65 + 0.35
    base = np.array([0.60, 0.68, 0.80])  # neutral blue-gray
    colors = np.clip(np.outer(intensity, base), 0, 1)

    lo, hi = mesh.bounds
    spans = hi - lo
    pad = spans.max() * 0.05

    dpi = 100
    fig_inches = args.size / dpi
    fig = plt.figure(figsize=(fig_inches, fig_inches), dpi=dpi)

    for i, (name, elev, azim) in enumerate(VIEWS, start=1):
        ax = fig.add_subplot(2, 2, i, projection="3d")
        pc = Poly3DCollection(tris, facecolors=colors, edgecolors="none")
        ax.add_collection3d(pc)
        ax.set_xlim(lo[0] - pad, hi[0] + pad)
        ax.set_ylim(lo[1] - pad, hi[1] + pad)
        ax.set_zlim(lo[2] - pad, hi[2] + pad)
        ax.set_box_aspect(spans + 2 * pad)
        ax.view_init(elev=elev, azim=azim)
        ax.set_axis_off()
        ax.set_title(f"{name} (elev {elev:g}, azim {azim:g})", fontsize=9)

    fig.suptitle(
        f"{args.stl}  |  {spans[0]:.1f} x {spans[1]:.1f} x {spans[2]:.1f} mm",
        fontsize=10,
    )
    fig.tight_layout()
    fig.savefig(out_path, bbox_inches="tight")
    plt.close(fig)

    print(json.dumps({
        "png": out_path,
        "views": [v[0] for v in VIEWS],
        "dims_mm": [round(float(s), 2) for s in spans],
    }))
    return 0


if __name__ == "__main__":
    sys.exit(main())
