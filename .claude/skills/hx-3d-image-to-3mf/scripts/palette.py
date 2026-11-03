"""Stage 1: analyse the reference image -> palette.json, silhouette.png, quantized.png.

    python palette.py ref.png OUT_DIR [--k 6]

Finds the background (border colour), the character silhouette and its dominant colours
(k-means in CIELAB). Gives pixel-measured proportions Claude uses for the model.
These are MEASUREMENTS OF THE IMAGE, not of the real object.
"""
import argparse, json
from pathlib import Path
import numpy as np
from PIL import Image
from sklearn.cluster import KMeans


def srgb_to_lab(a):
    a = a / 255.0
    a = np.where(a > 0.04045, ((a + 0.055) / 1.055) ** 2.4, a / 12.92)
    M = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
    xyz = a @ M.T / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("image"); ap.add_argument("out"); ap.add_argument("--k", type=int, default=6)
    ap.add_argument("--bg-tol", type=float, default=14.0)
    a = ap.parse_args()
    out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
    im = Image.open(a.image)
    has_alpha = im.mode in ("RGBA", "LA") or "transparency" in im.info
    im = im.convert("RGBA")
    arr = np.array(im)
    rgb = arr[..., :3].astype(float)
    h, w = rgb.shape[:2]
    lab = srgb_to_lab(rgb)

    border = np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]])
    bg = np.median(border, axis=0)
    dist = np.linalg.norm(lab - bg, axis=-1)
    fg = dist > a.bg_tol
    if has_alpha and arr[..., 3].min() < 250:
        fg = arr[..., 3] > 127
    ys, xs = np.where(fg)
    if len(xs) < 50:
        raise SystemExit("could not find a foreground object (background too similar?)")
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    bh, bw = y1 - y0 + 1, x1 - x0 + 1

    pix = lab[fg]
    k = min(a.k, 10)
    km = KMeans(n_clusters=k, n_init=4, random_state=0).fit(pix)
    # merge near-identical clusters (shading variants) by Lab distance
    cent = km.cluster_centers_; lab_ids = km.labels_
    parent = list(range(k))
    def find(i):
        while parent[i] != i: i = parent[i]
        return i
    for i in range(k):
        for j in range(i + 1, k):
            if np.linalg.norm(cent[i] - cent[j]) < 12: parent[find(j)] = find(i)
    root = np.array([find(i) for i in range(k)])
    merged = root[lab_ids]
    full = np.full((h, w), -1); full[fg] = merged

    colors = []
    for r in sorted(set(root)):
        m = full == r
        n = int(m.sum())
        if n < 0.004 * fg.sum():  # ignore <0.4% specks (anti-alias, noise)
            continue
        yy, xx = np.where(m)
        mean = rgb[m].mean(0).round().astype(int)
        colors.append({
            "id": len(colors), "hex": "#%02x%02x%02x" % tuple(mean),
            "area_fraction": round(n / fg.sum(), 4),
            "bbox_norm": {"x0": round((xx.min() - x0) / bw, 3), "x1": round((xx.max() - x0) / bw, 3),
                          "y0": round((yy.min() - y0) / bh, 3), "y1": round((yy.max() - y0) / bh, 3)},
            "_mask_id": int(r)})
    colors.sort(key=lambda c: -c["area_fraction"])
    for i, c in enumerate(colors): c["id"] = i

    q = np.zeros((h, w, 3), np.uint8) + 255
    for c in colors:
        q[full == c["_mask_id"]] = [int(c["hex"][i:i + 2], 16) for i in (1, 3, 5)]
    Image.fromarray(q).save(out / "quantized.png")
    Image.fromarray((fg * 255).astype(np.uint8)).save(out / "silhouette.png")
    for c in colors: c.pop("_mask_id")

    res = {"image": str(a.image), "size_px": [w, h],
           "background_lab": bg.round(1).tolist(), "had_alpha": bool(has_alpha),
           "silhouette_bbox_px": [int(x0), int(y0), int(x1), int(y1)],
           "aspect_w_over_h": round(bw / bh, 3),
           "colors": colors,
           "warnings": (["single view only: back/sides/underside are NOT observed"] +
                        (["more than 6 colours: check AMS capacity"] if len(colors) > 6 else []))}
    (out / "palette.json").write_text(json.dumps(res, indent=2))
    print(json.dumps(res, indent=2))

if __name__ == "__main__":
    main()
