"""Multi-angle, multi-color STL preview renderer (text-to-cad-color fork).

Renders one or more STLs — each with its assigned color — into a single
4-view PNG (iso, front, side, top). Rendering is local and cheap; READING
the image with vision costs tokens — per SKILL.md, only analyze when the
user opted into the visual loop.

Usage:
    python render_preview.py --out views.png --part "body.stl=#1a1a1a" --part "merlons.stl=#cc2222"
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

LIGHT = np.array([0.4, -0.7, 0.6]) / np.linalg.norm([0.4, -0.7, 0.6])


def _hex_to_rgb01(hex_color: str) -> np.ndarray:
    h = hex_color.lstrip("#")
    return np.array([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)])


def main() -> int:
    ap = argparse.ArgumentParser(description="Render 4-view multi-color STL preview")
    ap.add_argument("--part", action="append", required=True,
                    help='One per region: "path.stl=#rrggbb"')
    ap.add_argument("--out", required=True, help="Output PNG path")
    ap.add_argument("--size", type=int, default=900,
                    help="Approx PNG width/height in px (default 900)")
    args = ap.parse_args()

    meshes = []
    for spec in args.part:
        path, _, hex_color = spec.rpartition("=")
        if not path:
            print(json.dumps({"error": f"bad --part spec (want path=#rrggbb): {spec}"}))
            return 2
        m = trimesh.load(path, force="mesh")
        base = _hex_to_rgb01(hex_color)
        intensity = np.clip(m.face_normals @ LIGHT, 0.0, 1.0) * 0.65 + 0.35
        colors = np.clip(np.outer(intensity, base), 0, 1)
        meshes.append((m, colors))

    all_bounds = np.array([m.bounds for m, _ in meshes])
    lo = all_bounds[:, 0, :].min(axis=0)
    hi = all_bounds[:, 1, :].max(axis=0)
    spans = hi - lo
    pad = spans.max() * 0.05

    dpi = 100
    fig_inches = args.size / dpi
    fig = plt.figure(figsize=(fig_inches, fig_inches), dpi=dpi)

    for i, (name, elev, azim) in enumerate(VIEWS, start=1):
        ax = fig.add_subplot(2, 2, i, projection="3d")
        for m, colors in meshes:
            pc = Poly3DCollection(m.triangles, facecolors=colors, edgecolors="none")
            ax.add_collection3d(pc)
        ax.set_xlim(lo[0] - pad, hi[0] + pad)
        ax.set_ylim(lo[1] - pad, hi[1] + pad)
        ax.set_zlim(lo[2] - pad, hi[2] + pad)
        ax.set_box_aspect(spans + 2 * pad)
        ax.view_init(elev=elev, azim=azim)
        ax.set_axis_off()
        ax.set_title(f"{name} (elev {elev:g}, azim {azim:g})", fontsize=9)

    fig.suptitle(
        f"{len(meshes)} color regions  |  {spans[0]:.1f} x {spans[1]:.1f} x {spans[2]:.1f} mm",
        fontsize=10,
    )
    fig.tight_layout()
    fig.savefig(args.out, bbox_inches="tight")
    plt.close(fig)

    print(json.dumps({
        "png": args.out,
        "views": [v[0] for v in VIEWS],
        "regions": len(meshes),
        "dims_mm": [round(float(s), 2) for s in spans],
    }))
    return 0


if __name__ == "__main__":
    sys.exit(main())
