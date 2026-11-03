"""Image Studio (local, deterministic): brand posts / ads / thumbnails / product shots by COMPOSITING. The product photo is placed pixel-faithfully
(only scaled, never regenerated or distorted), so product shape and colours are preserved by construction. Generative AI images need an engine (see engines.py)."""
from __future__ import annotations
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from .common import PAL, rgb
from . import render as R

PRESETS = {"instagram_post": (1080, 1350), "instagram_square": (1080, 1080), "story_reel_cover": (1080, 1920), "youtube_thumbnail": (1280, 720),
           "product_white": (2000, 2000), "ad_landscape": (1920, 1080), "logo_square": (1024, 1024)}


def _bg(kind, W, H):
    if kind == "paper": return R.paper_bg(W, H, 0)
    if kind == "white": return Image.new("RGB", (W, H), "white")
    if kind == "studio": return R.studio_bg(W, H)
    im = R.black_bg(W, H); return im      # brand black with pink glows


def compose(preset="instagram_post", bg="brand", headline="", sub="", price="", cta="", product_path=None, logo_path=None, font_id=None, product_shadow=True, product_card=False, size=None):
    W, H = size or PRESETS[preset]; dark = bg in ("brand", "studio"); ink = PAL["white"] if dark else PAL["ink"]
    im = _bg(bg, W, H).convert("RGBA"); d = ImageDraw.Draw(im); m = int(W * .07); y = int(H * .07)
    if headline:
        t, hl = R.text_sprite(headline, int(W * .075), ink, W - 2 * m, "center", font_id, highlight=not dark)
        if hl is not None: im.alpha_composite(hl, ((W - t.width) // 2, y))
        im.alpha_composite(t, ((W - t.width) // 2, y)); y += t.height + int(H * .015)
    if sub:
        t, _ = R.text_sprite(sub, int(W * .042), ink if dark else "#333333", W - 2 * m, "center", font_id); im.alpha_composite(t, ((W - t.width) // 2, y)); y += t.height
    bottom = H - int(H * .06); cta_h = 0
    if cta:
        t, _ = R.text_sprite(cta, int(W * .045), PAL["ink"], W - 4 * m, "center", font_id); bw, bh = t.width + int(W * .08), t.height + int(W * .035); cta_h = bh + int(H * .02)
        bx = (W - bw) // 2; by = bottom - bh; d.rounded_rectangle([bx, by, bx + bw, bottom], bh // 2, fill=rgb(PAL["pink"]), outline=rgb(PAL["ink"]), width=max(3, W // 300)); im.alpha_composite(t, (bx + (bw - t.width) // 2, by + (bh - t.height) // 2))
    area = (m, y + int(H * .02), W - m, bottom - cta_h - int(H * .02)); pw, ph = area[2] - area[0], area[3] - area[1]; placed = None
    if product_path:
        pr = Image.open(product_path).convert("RGBA"); s = min(pw / pr.width, ph / pr.height); nw, nh = int(pr.width * s), int(pr.height * s); pr = pr.resize((nw, nh), Image.LANCZOS)     # uniform scale only
        px, py = area[0] + (pw - nw) // 2, area[1] + (ph - nh) // 2
        if product_card: d.rounded_rectangle([px - 20, py - 20, px + nw + 20, py + nh + 20], 40, fill=rgb(PAL["white"]), outline=rgb(PAL["ink"]), width=6)
        elif product_shadow and pr.getchannel("A").getextrema()[0] < 255:
            sh = Image.new("RGBA", (W, H), (0, 0, 0, 0)); a = pr.getchannel("A").point(lambda v: int(v * .45)); blk = Image.new("RGBA", pr.size, (0, 0, 0, 255)); blk.putalpha(a); sh.paste(blk, (px + 14, py + 22), blk)
            im.alpha_composite(sh.filter(ImageFilter.GaussianBlur(max(6, W // 90))))
        im.alpha_composite(pr, (px, py)); placed = (px, py, nw, nh)
    if price:
        t, _ = R.text_sprite(price, int(W * .06), PAL["ink"], W // 2, "center", font_id); pad = int(W * .03); bw, bh = t.width + 2 * pad, t.height + pad; bx, by = W - m - bw, area[1]
        d.rounded_rectangle([bx, by, bx + bw, by + bh], bh // 2, fill=rgb(PAL["yellow"]), outline=rgb(PAL["ink"]), width=max(3, W // 300)); im.alpha_composite(t, (bx + pad, by + pad // 2))
    wm = R.wordmark(H if H < W else W, dark, logo_path); im.alpha_composite(wm, (int(W * .05), int(H * .02)) if not headline else (int(W * .04), int(H * .015)))
    return im.convert("RGB"), {"size": [W, H], "product_box": placed, "preserved_product": bool(product_path), "engine": "local compositor (no generative model)", "watermark": False}


def render_model_still(parts, W=1600, H=1600, az=32, elev=24, bg="studio", headline=None):
    """Product render of an HX 3D project (real geometry, real filament colours)."""
    m = R.TurntableModel(parts, 30000); b = R.studio_bg(W, H) if bg == "studio" else (R.paper_bg(W, H, 0) if bg == "paper" else Image.new("RGB", (W, H), "white"))
    return m.frame(W, H, az, elev, b)
