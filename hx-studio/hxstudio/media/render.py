"""Procedural frame renderer: VOX paper-grid explainer scenes, Ken-Burns image motion, 3D turntables, title cards, subtitles, logo."""
from __future__ import annotations
import math
from functools import lru_cache
import numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont
from .. import textgeo
from .common import PAL, rgb
from . import icons


def ease(x): x = min(max(x, 0.0), 1.0); return x * x * (3 - 2 * x)
def back(x): x = min(max(x, 0.0), 1.0); c = 1.70158; return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2


@lru_cache(maxsize=64)
def _font(path, size): return ImageFont.truetype(path, size, layout_engine=ImageFont.Layout.RAQM)


def _kw(text): return dict(direction="rtl", language="ar") if textgeo.is_arabic(text) else dict(language="en")


def wrap(text, font, max_w):
    kw = _kw(text); lines = []
    for para in text.split("\n"):
        cur = ""
        for w in para.split():
            t = (cur + " " + w).strip()
            if cur and font.getlength(t, **kw) > max_w: lines.append(cur); cur = w
            else: cur = t
        lines.append(cur)
    return lines


def text_sprite(text, size, color, max_w, align="center", font_id=None, highlight=False, stroke=None, line_gap=1.32):
    """-> (text RGBA, highlight RGBA|None). Arabic is shaped RTL by libraqm; highlight is a yellow marker bar behind each line."""
    f = _font(textgeo.font_path(font_id, text), size); kw = _kw(text); lines = wrap(text, f, max_w)
    lh = int(size * line_gap); pad = int(size * .25)
    widths = [int(f.getlength(l, **kw)) for l in lines]; W = int(max(widths) + 2 * pad + (stroke or 0) * 2); H = lh * len(lines) + pad
    t = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(t)
    h = Image.new("RGBA", (W, H), (0, 0, 0, 0)) if highlight else None; hd = ImageDraw.Draw(h) if highlight else None
    for i, (l, w) in enumerate(zip(lines, widths)):
        x = (W - w) / 2 if align == "center" else (W - w - pad if kw.get("direction") == "rtl" else pad)
        y = i * lh + pad / 2
        if highlight: hd.rounded_rectangle([x - pad * .5, y + size * .55, x + w + pad * .5, y + size * 1.28], size * .08, fill=rgb(PAL["yellow"]))
        d.text((x, y), l, font=f, fill=rgb(color), stroke_width=stroke or 0, stroke_fill=rgb(PAL["ink"]), **kw)
    return t, h


class Sprite:
    def __init__(self, img, x, y, at, dur=.45, anim="fade", hl=None, sfx=None, hl_rtl=False):
        self.img, self.x, self.y, self.at, self.dur, self.anim, self.hl, self.sfx, self.hl_rtl = img, x, y, at, dur, anim, hl, sfx, hl_rtl


def _paste(frame, im, x, y, alpha=1.0):
    if alpha <= 0: return
    if alpha < 1: a = im.getchannel("A").point(lambda v: int(v * alpha)); im = im.copy(); im.putalpha(a)
    frame.paste(im, (int(x), int(y)), im)


def draw_sprite(frame, sp: Sprite, t, cy=0):
    k = (t - sp.at) / max(sp.dur, 1e-6)
    if k <= 0: return
    x, y = sp.x, sp.y - cy
    if y > frame.height or y + sp.img.height < 0: return
    if sp.hl is not None:                                     # marker wipes in first, then text fades
        kk = ease(k * 1.4)
        w = max(1, int(sp.hl.width * kk))
        crop = sp.hl.crop((sp.hl.width - w, 0, sp.hl.width, sp.hl.height)) if sp.hl_rtl else sp.hl.crop((0, 0, w, sp.hl.height))
        _paste(frame, crop, x + (sp.hl.width - w if sp.hl_rtl else 0), y)
        _paste(frame, sp.img, x, y, ease((k - .25) / .75))
        return
    if sp.anim == "pop":
        s = max(.01, back(k)); im = sp.img if k >= 1 else sp.img.resize((max(1, int(sp.img.width * s)), max(1, int(sp.img.height * s))), Image.BILINEAR)
        _paste(frame, im, x + (sp.img.width - im.width) / 2, y + (sp.img.height - im.height) / 2, min(1, k * 3))
    elif sp.anim == "rise":                                    # bars grow from the bottom
        p = ease(k); h = max(1, int(sp.img.height * p)); crop = sp.img.crop((0, sp.img.height - h, sp.img.width, sp.img.height)); _paste(frame, crop, x, y + sp.img.height - h)
    else: _paste(frame, sp.img, x, y + (1 - ease(k)) * 18, ease(k))


# ------------------------------------------------------------------ backgrounds
@lru_cache(maxsize=8)
def _grid_tile(W, H, G):
    a = np.empty((H + G, W, 3), np.uint8); a[:] = rgb(PAL["paper"])[:3]
    line = rgb(PAL["grid"])[:3]
    a[:, ::G] = line; a[::G, :] = line
    a[:, 0::G * 5] = (200, 212, 224); a[0::G * 5, :] = (200, 212, 224)
    return a


def paper_bg(W, H, cy):
    G = max(24, W // 18); tile = _grid_tile(W, H, G); o = int(cy) % G
    return Image.fromarray(tile[o:o + H].copy(), "RGB")


def studio_bg(W, H):
    g = np.linspace(0, 1, H)[:, None, None]; a = (np.array([34, 34, 42]) * (1 - g) + np.array([10, 10, 14]) * g) * np.ones((H, W, 3)); return Image.fromarray(a.astype(np.uint8), "RGB")


def black_bg(W, H, t=0.0):
    a = np.zeros((H, W, 3), np.uint8); a[:] = rgb(PAL["black"])[:3]
    im = Image.fromarray(a, "RGB"); d = ImageDraw.Draw(im, "RGBA"); r = int(W * (.55 + .03 * math.sin(t * 1.2)))
    d.ellipse([-r * .4, H - r * .55, r * .6, H + r * .45], fill=(255, 102, 178, 38)); d.ellipse([W - r * .55, -r * .35, W + r * .45, r * .65], fill=(255, 102, 178, 26))
    return im


# ------------------------------------------------------------------ element → sprites
def prepare(sc: dict, W: int, H: int, dur: float, font_id=None):
    """Builds sprites for scene elements and lays them out in a vertical flow. Returns (sprites, V) with V = virtual canvas height."""
    els = sc.get("elements", []); dark = sc.get("bg") in ("black", "brand", "studio") or sc.get("kind") in ("title_card", "turntable", "image_motion")
    ink = PAL["white"] if dark else PAL["ink"]; margin = int(W * .08); maxw = W - 2 * margin; gap = int(H * .028)
    sprites = []; blocks = []; n = max(1, len(els)); stagger = min(.9, max(.35, dur * .6 / n)); tcur = .3
    for el in els:
        ty = el.get("type", "text"); at = el.get("at", tcur)
        if ty in ("title", "text"):
            sz = el.get("size"); dflt = .072 if ty == "title" else .05
            size = int(W * (dflt if sz is None else sz)) if (sz is None or sz < 1) else int(sz)
            t, h = text_sprite(el["text"], size, el.get("color", ink), maxw, "center", font_id, highlight=(ty == "title" and el.get("highlight", True)) and not dark)
            blocks.append(dict(img=t, hl=h, at=at, dur=.6 if h else .4, anim="fade", sfx="marker" if h else None, rtl=textgeo.is_arabic(el["text"]), w=t.width, h=t.height))
        elif ty == "bullets":
            for i, item in enumerate(el["items"]):
                t, _ = text_sprite(item, int(W * .047), ink, maxw - int(W * .1), "left", font_id)
                row = Image.new("RGBA", (t.width + int(W * .075), t.height), (0, 0, 0, 0)); d = ImageDraw.Draw(row); r = int(W * .017)
                rtl = textgeo.is_arabic(item); cxm = row.width - r - 4 if rtl else r + 4
                d.ellipse([cxm - r, t.height * .42 - r, cxm + r, t.height * .42 + r], fill=rgb(PAL["pink"]), outline=rgb(PAL["ink"]), width=3)
                row.paste(t, (0 if rtl else int(W * .075), 0), t)
                blocks.append(dict(img=row, hl=None, at=at + i * stagger * .8, dur=.4, anim="fade", sfx="click", rtl=rtl, w=row.width, h=row.height, tight=True))
        elif ty == "icon":
            s = int(W * el.get("size", .26)); blocks.append(dict(img=icons.render_icon(el.get("name", "cube"), s), hl=None, at=at, dur=.5, anim="pop", sfx="ding" if el.get("name") == "check" else "pop", rtl=False, w=s, h=s))
        elif ty == "stat":
            t, _ = text_sprite(str(el["value"]), int(W * .2), PAL["pink"], maxw, "center", font_id, stroke=max(3, W // 200)); lab = text_sprite(el.get("label", ""), int(W * .05), ink, maxw, "center", font_id)[0] if el.get("label") else None
            im = Image.new("RGBA", (max(t.width, lab.width if lab else 0), t.height + (lab.height if lab else 0)), (0, 0, 0, 0)); im.paste(t, ((im.width - t.width) // 2, 0), t)
            if lab: im.paste(lab, ((im.width - lab.width) // 2, t.height), lab)
            blocks.append(dict(img=im, hl=None, at=at, dur=.5, anim="pop", sfx="pop", rtl=False, w=im.width, h=im.height))
        elif ty == "badge":
            t, _ = text_sprite(el["text"], int(W * .05), PAL["ink"], maxw, "center", font_id); pad = int(W * .03)
            im = Image.new("RGBA", (t.width + 2 * pad, t.height + pad), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
            d.rounded_rectangle([2, 2, im.width - 3, im.height - 3], im.height // 2, fill=rgb(PAL["yellow"] if el.get("color") != "pink" else PAL["pink"]), outline=rgb(PAL["ink"]), width=4); im.paste(t, (pad, pad // 2), t)
            blocks.append(dict(img=im, hl=None, at=at, dur=.45, anim="pop", sfx="pop", rtl=False, w=im.width, h=im.height))
        elif ty == "chart":
            vals = el["values"]; labs = el.get("labels", [""] * len(vals)); cw = int(W * .8); ch = int(W * .5); im = Image.new("RGBA", (cw, ch + int(W * .08)), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
            bw = cw / (len(vals) * 1.6); mx = max(vals) or 1; cols = [PAL["pink"], PAL["yellow"], "#FFFFFF"]
            for i, v in enumerate(vals):
                x0 = cw * .06 + i * bw * 1.6; hgt = ch * .9 * v / mx; d.rectangle([x0, ch - hgt, x0 + bw, ch], fill=rgb(cols[i % 3]), outline=rgb(PAL["ink"]), width=4)
                if labs[i]: tl, _ = text_sprite(str(labs[i]), int(W * .035), ink, int(bw * 1.5), "center", font_id); im.paste(tl, (int(x0 + bw / 2 - tl.width / 2), ch + 4), tl)
            d.line([(0, ch), (cw, ch)], fill=rgb(PAL["ink"]), width=5)
            blocks.append(dict(img=im, hl=None, at=at, dur=.9, anim="rise", sfx="pop", rtl=False, w=cw, h=im.height))
        elif ty == "image":
            src = Image.open(el["path"]).convert("RGBA"); w = int(W * el.get("width", .78)); h = int(src.height * w / src.width); src = src.resize((w, h), Image.LANCZOS)
            im = Image.new("RGBA", (w + 16, h + 16), (0, 0, 0, 0)); d = ImageDraw.Draw(im); d.rounded_rectangle([0, 0, w + 15, h + 15], 28, fill=rgb(PAL["white"]), outline=rgb(PAL["ink"]), width=6); im.paste(src, (8, 8), src)
            blocks.append(dict(img=im, hl=None, at=at, dur=.5, anim="pop", sfx="pop", rtl=False, w=im.width, h=im.height))
        tcur = at + stagger
    total = sum(b["h"] + gap for b in blocks) - (gap if blocks else 0); top = margin if sc.get("kind") in ("vox",) else None
    anchor = sc.get("anchor", "center" if sc.get("kind") in ("title_card",) else "bottom")
    V = max(H, total + 2 * int(H * .09))
    if sc.get("kind") == "vox": y = max(int(H * .09), int((H - total) * .4)) if V == H else int(H * .09)
    elif anchor == "bottom": y = H - total - int(H * .12)
    elif anchor == "top": y = int(H * .1)
    else: y = (H - total) // 2
    for b in blocks:
        sprites.append(Sprite(b["img"], (W - b["w"]) // 2, y, b["at"], b["dur"], b["anim"], b["hl"], b["sfx"], b["rtl"])); y += b["h"] + (gap // 2 if b.get("tight") else gap)
    return sprites, V


# ------------------------------------------------------------------ scene renderers
def cover(im: Image.Image, W, H): s = max(W / im.width, H / im.height); return im.resize((int(im.width * s) + 1, int(im.height * s) + 1), Image.LANCZOS)


def ken_burns(img_rgb: np.ndarray, W, H, k, cam):
    z0, z1, px, py = 1.0, 1.0, 0.0, 0.0
    c = cam.get("type", "zoom_in")
    if c == "zoom_in": z0, z1 = 1.0, 1.0 + cam.get("amount", .18)
    elif c == "zoom_out": z0, z1 = 1.0 + cam.get("amount", .18), 1.0
    elif c in ("pan_left", "pan_right", "pan_up", "pan_down"): z0 = z1 = 1.0 + cam.get("amount", .2)
    z = z0 + (z1 - z0) * ease(k); h, w = img_rgb.shape[:2]; vw, vh = w / z, h / z
    spanx, spany = w - vw, h - vh
    fx = {"pan_left": 1 - ease(k), "pan_right": ease(k)}.get(c, .5); fy = {"pan_up": 1 - ease(k), "pan_down": ease(k)}.get(c, .5)
    x0, y0 = spanx * fx, spany * fy
    M = np.float32([[W / vw, 0, -x0 * W / vw], [0, H / vh, -y0 * H / vh]])
    return Image.fromarray(cv2.warpAffine(img_rgb, M, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE))


class TurntableModel:
    def __init__(self, parts, max_faces=9000):
        import trimesh
        allf = sum(len(m.faces) for m, _ in parts); V, F, C = [], [], []; off = 0
        for m, col in parts:
            mm = m
            if allf > max_faces and len(m.faces) > 200:
                try: mm = m.simplify_quadric_decimation(face_count=max(150, int(len(m.faces) * max_faces / allf)))
                except Exception: mm = m
            V.append(mm.vertices); F.append(mm.faces + off); C += [rgb(col)[:3]] * len(mm.faces); off += len(mm.vertices)
        self.V = np.vstack(V); self.F = np.vstack(F); self.C = np.array(C, float)
        self.c = (self.V.max(0) + self.V.min(0)) / 2; self.r = np.linalg.norm(self.V - self.c, axis=1).max()
        tri = self.V[self.F]; n = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0]); self.N = n / (np.linalg.norm(n, axis=1, keepdims=True) + 1e-12)

    def frame(self, W, H, az_deg, elev=24, bg=None, scale=.9):
        a = math.radians(az_deg); R = np.array([[math.cos(a), -math.sin(a), 0], [math.sin(a), math.cos(a), 0], [0, 0, 1]]); e = math.radians(elev)
        P = (self.V - self.c) @ R.T; N = self.N @ R.T; u = np.array([0, math.sin(e), math.cos(e)]); f = np.array([0, math.cos(e), -math.sin(e)])
        sx = P[:, 0]; sy = P @ u; dep = P @ f; s = min(W, H) * scale / (self.r * 2)
        X = W / 2 + sx * s; Y = H * .52 - sy * s; tri = self.F; fd = dep[tri].mean(1); vis = (N @ f) < 0.05
        light = np.array([-.35, -.55, .75]); light /= np.linalg.norm(light); sh = .5 + .5 * np.clip(N @ light, 0, 1)
        idx = np.where(vis)[0]; idx = idx[np.argsort(-fd[idx])]
        im = bg.copy() if bg is not None else Image.new("RGB", (W, H), "white"); d = ImageDraw.Draw(im)
        rim = np.clip(1 - np.abs(N @ f), 0, 1) ** 2; col = np.clip(self.C * sh[:, None] + 30 * sh[:, None] + 70 * rim[:, None], 0, 255).astype(int)   # lift + rim light so near-black filament stays visible
        for i in idx: t = tri[i]; d.polygon([(X[t[0]], Y[t[0]]), (X[t[1]], Y[t[1]]), (X[t[2]], Y[t[2]])], fill=tuple(col[i]))
        return im


def render_scene(sc, P, t):
    """P = prepared scene dict. Returns RGB PIL frame at scene-relative time t (clamped to the scene length)."""
    W, H, dur = P["W"], P["H"], P["dur"]; t = min(max(t, 0), dur); k = t / max(dur, 1e-6); kind = sc.get("kind", "vox"); cam = sc.get("camera", {"type": "pan_down"})
    if kind == "vox":
        cy = 0
        if P["V"] > H: cy = ease(k) * (P["V"] - H) if cam.get("type", "pan_down") != "pan_up" else (1 - ease(k)) * (P["V"] - H)
        elif cam.get("type", "pan_down") != "static": cy = -ease(k) * 0 + math.sin(k * math.pi) * 0
        fr = paper_bg(W, H, cy)
        for sp in P["sprites"]: draw_sprite(fr, sp, t, cy)
        return fr
    if kind == "title_card":
        fr = black_bg(W, H, t)
    elif kind == "image_motion": fr = ken_burns(P["img"], W, H, k, cam)
    elif kind == "turntable":
        bg = paper_bg(W, H, 0) if sc.get("bg", "studio") == "paper" else studio_bg(W, H)
        fr = P["model"].frame(W, H, 360 * k * sc.get("turns", .6) + sc.get("start_az", 25), sc.get("elev", 24), bg)
    else: raise ValueError("unknown scene kind " + kind)
    for sp in P["sprites"]: draw_sprite(fr, sp, t)
    return fr


def subtitle_sprite(text, W, H, font_id=None):
    t, _ = text_sprite(text, int(W * .043), "#FFFFFF", int(W * .84), "center", font_id, line_gap=1.28); pad = int(W * .025)
    im = Image.new("RGBA", (t.width + 2 * pad, t.height + pad), (0, 0, 0, 0)); d = ImageDraw.Draw(im); d.rounded_rectangle([0, 0, im.width - 1, im.height - 1], int(W * .02), fill=(5, 5, 5, 205)); im.paste(t, (pad, pad // 2), t)
    return im


def wordmark(H, dark, logo_path=None):
    h = int(H * .035)
    if logo_path:
        lg = Image.open(logo_path).convert("RGBA"); return lg.resize((int(lg.width * h / lg.height), h), Image.LANCZOS)     # aspect preserved: never distorted
    f = _font(textgeo.font_path("sans-bold", "HX"), h); im = Image.new("RGBA", (int(f.getlength("HX3D") + 12), int(h * 1.4)), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.text((4, 0), "HX", font=f, fill=rgb(PAL["white"] if dark else PAL["ink"])); d.text((4 + f.getlength("HX"), 0), "3D", font=f, fill=rgb(PAL["pink"])); return im
