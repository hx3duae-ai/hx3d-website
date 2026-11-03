"""Text / raster -> vector polygons (Arabic shaping via Pillow+libraqm, outlines via OpenCV)."""
from __future__ import annotations
import re
from pathlib import Path
import numpy as np
import cv2
from PIL import Image, ImageDraw, ImageFont
from shapely.geometry import Polygon
from shapely.ops import unary_union
from shapely import affinity
from .config import FONTS

ARABIC = re.compile(r"[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]")
FONT_FILES = {"amiri": "Amiri-Regular.ttf", "amiri-bold": "Amiri-Bold.ttf", "sans-bold": "DejaVuSans-Bold.ttf"}


def is_arabic(s: str) -> bool:
    return bool(ARABIC.search(s))


def font_path(name: str | None, text: str, custom: str | None = None) -> str:
    if custom and Path(custom).exists(): return custom
    if name in FONT_FILES: return str(FONTS / FONT_FILES[name])
    return str(FONTS / ("Amiri-Bold.ttf" if is_arabic(text) else "DejaVuSans-Bold.ttf"))


def mask_to_polygons(mask: np.ndarray, mm_per_px: float = 1.0, eps_px: float = 0.7, min_area_px: float = 6) -> list:
    """Binary mask (H,W) -> list of shapely Polygons (holes preserved), Y up, origin lower-left."""
    m = (mask > 0).astype(np.uint8)
    cnts, hier = cv2.findContours(m, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
    if hier is None: return []
    hier = hier[0]; H = m.shape[0]; out = []
    def pts(c):
        c = cv2.approxPolyDP(c, eps_px, True)[:, 0, :].astype(float)
        return [(x * mm_per_px, (H - y) * mm_per_px) for x, y in c]
    for i, c in enumerate(cnts):
        if hier[i][3] != -1: continue                   # holes are handled with their parent
        if cv2.contourArea(c) < min_area_px or len(c) < 3: continue
        holes = []; j = hier[i][2]
        while j != -1:
            if cv2.contourArea(cnts[j]) >= min_area_px and len(cnts[j]) >= 3: holes.append(pts(cnts[j]))
            j = hier[j][0]
        p = Polygon(pts(c), [h for h in holes if len(h) >= 3])
        if not p.is_valid: p = p.buffer(0)
        if not p.is_empty: out.append(p)
    return out


def text_polygons(text: str, height_mm: float, font: str | None = None, custom_font: str | None = None,
                  max_width_mm: float | None = None, bold: bool = True):
    """Return shapely geometry of `text`, ink bbox height == height_mm (or limited by max_width), origin at bbox centre."""
    text = text.strip()
    if not text: raise ValueError("empty text")
    fp = font_path(font, text, custom_font)
    px = 220
    f = ImageFont.truetype(fp, px, layout_engine=ImageFont.Layout.RAQM)
    lines = text.split("\n"); ar = is_arabic(text)
    kw = dict(direction="rtl", language="ar") if ar else dict(language="en")
    boxes = [f.getbbox(l, **kw) for l in lines]
    lh = int(px * 1.25)
    W = int(max(b[2] for b in boxes) + 80); Hh = lh * len(lines) + 80
    im = Image.new("L", (W, Hh), 0); d = ImageDraw.Draw(im)
    for i, l in enumerate(lines):
        w = f.getlength(l, **kw)
        x = (W - w) / 2
        d.text((x, 30 + i * lh), l, font=f, fill=255, **kw)
    geo = unary_union(mask_to_polygons(np.array(im), 1.0, eps_px=0.8))
    if geo.is_empty: raise ValueError("text produced no outlines (font lacks these glyphs?)")
    x0, y0, x1, y1 = geo.bounds
    s = height_mm / (y1 - y0)
    if max_width_mm and (x1 - x0) * s > max_width_mm: s = max_width_mm / (x1 - x0)
    geo = affinity.scale(geo, s, s, origin=(0, 0))
    x0, y0, x1, y1 = geo.bounds
    return affinity.translate(geo, -(x0 + x1) / 2, -(y0 + y1) / 2)


def fit(geo, w: float, h: float):
    """Scale to fit inside w x h (keep aspect) and centre on origin."""
    x0, y0, x1, y1 = geo.bounds
    s = min(w / (x1 - x0), h / (y1 - y0))
    g = affinity.scale(geo, s, s, origin=(0, 0)); x0, y0, x1, y1 = g.bounds
    return affinity.translate(g, -(x0 + x1) / 2, -(y0 + y1) / 2)
