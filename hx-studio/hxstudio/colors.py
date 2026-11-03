"""Colour science: CIEDE2000 matching of image/model colours to the user's filament inventory + AMS planning."""
from __future__ import annotations
import math
import numpy as np


def hex_rgb(h): h = h.lstrip("#"); return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))
def rgb_hex(c): return "#%02x%02x%02x" % tuple(int(round(max(0, min(255, v)))) for v in c)


def rgb_to_lab(rgb):
    a = np.array(rgb, float) / 255.0
    a = np.where(a > 0.04045, ((a + 0.055) / 1.055) ** 2.4, a / 12.92)
    M = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
    xyz = M @ a / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.array([116 * f[1] - 16, 500 * (f[0] - f[1]), 200 * (f[1] - f[2])])


def delta_e2000(l1, l2):
    L1, a1, b1 = l1; L2, a2, b2 = l2
    C1, C2 = math.hypot(a1, b1), math.hypot(a2, b2); Cm = (C1 + C2) / 2
    G = 0.5 * (1 - math.sqrt(Cm ** 7 / (Cm ** 7 + 25 ** 7)))
    a1p, a2p = (1 + G) * a1, (1 + G) * a2
    C1p, C2p = math.hypot(a1p, b1), math.hypot(a2p, b2)
    h1 = math.degrees(math.atan2(b1, a1p)) % 360; h2 = math.degrees(math.atan2(b2, a2p)) % 360
    dL = L2 - L1; dC = C2p - C1p
    dh = h2 - h1
    if C1p * C2p == 0: dh = 0
    elif dh > 180: dh -= 360
    elif dh < -180: dh += 360
    dH = 2 * math.sqrt(C1p * C2p) * math.sin(math.radians(dh / 2))
    Lm = (L1 + L2) / 2; Cmp = (C1p + C2p) / 2
    if C1p * C2p == 0: hm = h1 + h2
    elif abs(h1 - h2) <= 180: hm = (h1 + h2) / 2
    else: hm = (h1 + h2 + 360) / 2 if h1 + h2 < 360 else (h1 + h2 - 360) / 2
    T = 1 - 0.17 * math.cos(math.radians(hm - 30)) + 0.24 * math.cos(math.radians(2 * hm)) + 0.32 * math.cos(math.radians(3 * hm + 6)) - 0.20 * math.cos(math.radians(4 * hm - 63))
    dth = 30 * math.exp(-(((hm - 275) / 25) ** 2))
    Rc = 2 * math.sqrt(Cmp ** 7 / (Cmp ** 7 + 25 ** 7))
    Sl = 1 + 0.015 * (Lm - 50) ** 2 / math.sqrt(20 + (Lm - 50) ** 2); Sc = 1 + 0.045 * Cmp; Sh = 1 + 0.015 * Cmp * T
    Rt = -math.sin(math.radians(2 * dth)) * Rc
    return math.sqrt((dL / Sl) ** 2 + (dC / Sc) ** 2 + (dH / Sh) ** 2 + Rt * (dC / Sc) * (dH / Sh))


def de(h1, h2): return delta_e2000(rgb_to_lab(hex_rgb(h1)), rgb_to_lab(hex_rgb(h2)))


def verdict(d):
    return "excellent" if d < 2 else "close" if d < 5 else "noticeable" if d < 10 else "poor"


EXAMPLE_INVENTORY = [   # EXAMPLE ONLY - the user edits this to their real spools
    {"id": "ex-white", "name": "White PLA (example)", "material": "PLA", "hex": "#f2f2f2", "grams": 1000},
    {"id": "ex-black", "name": "Black PLA (example)", "material": "PLA", "hex": "#111111", "grams": 1000},
    {"id": "ex-red", "name": "Red PLA (example)", "material": "PLA", "hex": "#c62828", "grams": 1000},
    {"id": "ex-pink", "name": "Pink PLA (example)", "material": "PLA", "hex": "#ff66b2", "grams": 1000},
    {"id": "ex-blue", "name": "Blue PLA (example)", "material": "PLA", "hex": "#1565c0", "grams": 1000},
    {"id": "ex-orange", "name": "Orange PLA (example)", "material": "PLA", "hex": "#ef6c00", "grams": 1000},
]


def match(colors: list[str], inventory: list[dict], material: str | None = None, alternatives: int = 3):
    pool = [f for f in inventory if (not material or f.get("material", material) == material)]
    out = []
    for c in colors:
        if not pool: out.append({"target": c, "match": None, "delta_e": None, "verdict": "no inventory", "alternatives": []}); continue
        ranked = sorted(({"filament": f, "delta_e": round(de(c, f["hex"]), 2)} for f in pool), key=lambda r: r["delta_e"])
        b = ranked[0]
        out.append({"target": c, "match": b["filament"], "delta_e": b["delta_e"], "verdict": verdict(b["delta_e"]),
                    "alternatives": ranked[1:1 + alternatives],
                    "suggest_buy": b["delta_e"] >= 10})
    return out


def plan_ams(matches: list[dict], slots_per_unit=4):
    used = []
    for m in matches:
        if m["match"] and m["match"]["id"] not in [u["id"] for u in used]: used.append(m["match"])
    n = len(used); units = -(-n // slots_per_unit) if n else 0
    return {"filaments_needed": n, "ams_units": units, "slots": [{"slot": i + 1, "unit": i // slots_per_unit + 1, "filament": f} for i, f in enumerate(used)],
            "warning": None if units <= 1 else f"needs {units} AMS units (or manual swaps); consider merging colours"}


def reduce_colors(colors: list[tuple[str, float]], max_colors: int):
    """Merge nearest colour pairs (by dE2000, area-weighted) until <= max_colors. colors = [(hex, weight)]."""
    cs = [[h, w] for h, w in colors]
    while len(cs) > max_colors:
        best = None
        for i in range(len(cs)):
            for j in range(i + 1, len(cs)):
                d = de(cs[i][0], cs[j][0])
                if best is None or d < best[0]: best = (d, i, j)
        _, i, j = best
        a, b = cs[i], cs[j]; wa, wb = a[1], b[1]
        mix = [(x * wa + y * wb) / (wa + wb) for x, y in zip(hex_rgb(a[0]), hex_rgb(b[0]))]
        cs[i] = [rgb_hex(mix), wa + wb]; cs.pop(j)
    return [(h, w) for h, w in cs]
