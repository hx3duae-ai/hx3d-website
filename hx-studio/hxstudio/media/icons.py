"""Flat hand-drawn style vector icons (black outline, pink/yellow accents), drawn 4x supersampled."""
from __future__ import annotations
import math
from PIL import Image, ImageDraw
from .common import PAL, rgb

INK = rgb(PAL["ink"]); PINK = rgb(PAL["pink"]); YEL = rgb(PAL["yellow"]); WHITE = rgb("#FFFFFF"); GREY = rgb("#E6E9EE")


def _lw(s): return max(4, s // 22)


def printer3d(d, s):
    w = _lw(s); d.rounded_rectangle([s*.12, s*.1, s*.88, s*.9], s*.04, outline=INK, width=w)
    d.line([s*.12, s*.22, s*.88, s*.22], fill=INK, width=w); d.rectangle([s*.2, s*.78, s*.8, s*.84], fill=PINK, outline=INK, width=w//2)
    d.rectangle([s*.42, s*.2, s*.58, s*.3], fill=YEL, outline=INK, width=w//2); d.polygon([(s*.46, s*.3), (s*.54, s*.3), (s*.5, s*.4)], fill=INK)
    d.rounded_rectangle([s*.36, s*.62, s*.64, s*.78], s*.02, fill=PINK, outline=INK, width=w//2)


def cube(d, s):
    w = _lw(s); c = s/2; r = s*.36
    pts = [(c, c-r), (c+r*.87, c-r*.5), (c+r*.87, c+r*.5), (c, c+r), (c-r*.87, c+r*.5), (c-r*.87, c-r*.5)]
    d.polygon(pts, fill=WHITE, outline=INK); d.polygon([pts[0], pts[1], (c, c), pts[5]], fill=YEL)
    d.polygon([pts[1], pts[2], pts[3], (c, c)], fill=PINK); d.line(pts + [pts[0]], fill=INK, width=w); d.line([(c, c), pts[0]], fill=INK, width=w); d.line([(c, c), pts[2]], fill=INK, width=w); d.line([(c, c), pts[4]], fill=INK, width=w)


def gear(d, s):
    w = _lw(s); c = s/2; n = 8; pts = []
    for i in range(n*2):
        a = math.pi * i / n; r = s*.4 if i % 2 == 0 else s*.31
        for da in (-.12, .12): pts.append((c + r*math.cos(a+da), c + r*math.sin(a+da)))
    d.polygon(pts, fill=YEL, outline=INK); d.line(pts + [pts[0]], fill=INK, width=w); d.ellipse([c-s*.13, c-s*.13, c+s*.13, c+s*.13], fill=WHITE, outline=INK, width=w)


def layers(d, s):
    w = _lw(s)
    for i, col in enumerate((PINK, YEL, WHITE)):
        y = s*(.62 - i*.17); d.polygon([(s*.5, y-s*.16), (s*.88, y), (s*.5, y+s*.16), (s*.12, y)], fill=col, outline=INK); d.line([(s*.5, y-s*.16), (s*.88, y), (s*.5, y+s*.16), (s*.12, y), (s*.5, y-s*.16)], fill=INK, width=w)


def spool(d, s):
    w = _lw(s); d.ellipse([s*.1, s*.2, s*.9, s*.8], fill=PINK, outline=INK, width=w); d.ellipse([s*.3, s*.4, s*.7, s*.6], fill=WHITE, outline=INK, width=w); d.ellipse([s*.45, s*.47, s*.55, s*.53], fill=INK)


def thermometer(d, s):
    w = _lw(s); d.rounded_rectangle([s*.42, s*.1, s*.58, s*.66], s*.08, fill=WHITE, outline=INK, width=w); d.ellipse([s*.32, s*.56, s*.68, s*.92], fill=PINK, outline=INK, width=w); d.rectangle([s*.47, s*.3, s*.53, s*.7], fill=PINK)


def check(d, s):
    w = _lw(s); d.ellipse([s*.1, s*.1, s*.9, s*.9], fill=YEL, outline=INK, width=w); d.line([(s*.28, s*.52), (s*.44, s*.68), (s*.74, s*.34)], fill=INK, width=w*2, joint="curve")


def cross(d, s):
    w = _lw(s); d.ellipse([s*.1, s*.1, s*.9, s*.9], fill=PINK, outline=INK, width=w); d.line([(s*.32, s*.32), (s*.68, s*.68)], fill=INK, width=w*2); d.line([(s*.68, s*.32), (s*.32, s*.68)], fill=INK, width=w*2)


def warning(d, s):
    w = _lw(s); d.polygon([(s*.5, s*.1), (s*.92, s*.84), (s*.08, s*.84)], fill=YEL, outline=INK); d.line([(s*.5, s*.1), (s*.92, s*.84), (s*.08, s*.84), (s*.5, s*.1)], fill=INK, width=w); d.line([(s*.5, s*.38), (s*.5, s*.6)], fill=INK, width=w*2); d.ellipse([s*.46, s*.68, s*.54, s*.76], fill=INK)


def clock(d, s):
    w = _lw(s); c = s/2; d.ellipse([s*.1, s*.1, s*.9, s*.9], fill=WHITE, outline=INK, width=w); d.line([(c, c), (c, s*.26)], fill=INK, width=w); d.line([(c, c), (s*.7, c+s*.1)], fill=PINK, width=w); d.ellipse([c-w, c-w, c+w, c+w], fill=INK)


def money(d, s):
    w = _lw(s); d.ellipse([s*.1, s*.1, s*.9, s*.9], fill=YEL, outline=INK, width=w); d.ellipse([s*.22, s*.22, s*.78, s*.78], outline=INK, width=w//2)
    d.line([(s*.5, s*.3), (s*.5, s*.7)], fill=INK, width=w); d.arc([s*.36, s*.34, s*.64, s*.52], 90, 330, fill=INK, width=w); d.arc([s*.36, s*.48, s*.64, s*.66], 270, 150, fill=INK, width=w)


def ruler(d, s):
    w = _lw(s); d.polygon([(s*.08, s*.62), (s*.62, s*.08), (s*.92, s*.38), (s*.38, s*.92)], fill=YEL, outline=INK)
    d.line([(s*.08, s*.62), (s*.62, s*.08), (s*.92, s*.38), (s*.38, s*.92), (s*.08, s*.62)], fill=INK, width=w)
    for i in range(1, 6): t = i/6; x0 = s*(.08 + .3*t*2) ; d.line([(s*.08 + (s*.3)*t*1.0 + s*.09*t, s*.62 - (s*.54)*t*.5 - s*.0), (s*.08 + s*.3*t + s*.09*t + s*.07, s*.62 - s*.27*t - s*.07 + s*.14*0)], fill=INK, width=max(2, w//2))


def bolt(d, s):
    w = _lw(s); pts = [(s*.58, s*.06), (s*.2, s*.54), (s*.46, s*.54), (s*.38, s*.94), (s*.8, s*.4), (s*.54, s*.4)]; d.polygon(pts, fill=YEL); d.line(pts + [pts[0]], fill=INK, width=w, joint="curve")


def idea(d, s):
    w = _lw(s); d.ellipse([s*.22, s*.08, s*.78, s*.64], fill=YEL, outline=INK, width=w); d.rectangle([s*.38, s*.64, s*.62, s*.82], fill=WHITE, outline=INK, width=w); d.line([(s*.4, s*.9), (s*.6, s*.9)], fill=INK, width=w)
    for a in (-60, 0, 60): x = s*.5 + s*.5*math.sin(math.radians(a)); y = s*.36 - s*.5*math.cos(math.radians(a)) * .0; d.line([(s*.5 + s*.34*math.sin(math.radians(a)), s*.36 - s*.34*math.cos(math.radians(a))), (s*.5 + s*.46*math.sin(math.radians(a)), s*.36 - s*.46*math.cos(math.radians(a)))], fill=PINK, width=w)


def truck(d, s):
    w = _lw(s); d.rectangle([s*.06, s*.28, s*.6, s*.7], fill=WHITE, outline=INK, width=w); d.polygon([(s*.6, s*.4), (s*.82, s*.4), (s*.94, s*.56), (s*.94, s*.7), (s*.6, s*.7)], fill=PINK, outline=INK)
    d.line([(s*.6, s*.4), (s*.82, s*.4), (s*.94, s*.56), (s*.94, s*.7), (s*.6, s*.7), (s*.6, s*.4)], fill=INK, width=w)
    for x in (.24, .78): d.ellipse([s*(x-.1), s*.6, s*(x+.1), s*.8], fill=YEL, outline=INK, width=w)


def box(d, s):
    w = _lw(s); d.rectangle([s*.12, s*.28, s*.88, s*.86], fill=YEL, outline=INK, width=w); d.polygon([(s*.12, s*.28), (s*.3, s*.12), (s*.88, s*.12), (s*.88, s*.28)], fill=PINK, outline=INK); d.line([(s*.12, s*.28), (s*.3, s*.12), (s*.88, s*.12), (s*.88, s*.28)], fill=INK, width=w); d.line([(s*.5, s*.12), (s*.5, s*.5)], fill=INK, width=w)


def phone(d, s):
    w = _lw(s); d.rounded_rectangle([s*.28, s*.06, s*.72, s*.94], s*.07, fill=WHITE, outline=INK, width=w); d.rounded_rectangle([s*.34, s*.16, s*.66, s*.8], s*.02, fill=PINK, outline=INK, width=w//2); d.ellipse([s*.46, s*.84, s*.54, s*.9], fill=INK)


def lock(d, s):
    w = _lw(s); d.arc([s*.28, s*.08, s*.72, s*.56], 180, 360, fill=INK, width=w*2); d.rounded_rectangle([s*.2, s*.4, s*.8, s*.9], s*.05, fill=YEL, outline=INK, width=w); d.ellipse([s*.44, s*.56, s*.56, s*.68], fill=INK)


def star(d, s):
    w = _lw(s); c = s/2; pts = []
    for i in range(10): r = s*.42 if i % 2 == 0 else s*.18; a = -math.pi/2 + i*math.pi/5; pts.append((c + r*math.cos(a), c + r*math.sin(a)))
    d.polygon(pts, fill=YEL); d.line(pts + [pts[0]], fill=INK, width=w, joint="curve")


def heart(d, s):
    w = _lw(s); pts = []
    for i in range(60): t = math.pi*2*i/60; pts.append((s*.5 + s*.026*16*math.sin(t)**3, s*.46 - s*.026*(13*math.cos(t) - 5*math.cos(2*t) - 2*math.cos(3*t) - math.cos(4*t)))); 
    d.polygon(pts, fill=PINK); d.line(pts + [pts[0]], fill=INK, width=w, joint="curve")


def person(d, s):
    w = _lw(s); d.ellipse([s*.32, s*.1, s*.68, s*.46], fill=YEL, outline=INK, width=w); d.pieslice([s*.14, s*.5, s*.86, s*1.2], 180, 360, fill=PINK, outline=INK, width=w)


def chart(d, s):
    w = _lw(s)
    for i, (h, col) in enumerate(((.35, YEL), (.6, PINK), (.85, WHITE))): x = s*(.16 + i*.27); d.rectangle([x, s*(.9-h), x+s*.2, s*.9], fill=col, outline=INK, width=w)
    d.line([(s*.08, s*.92), (s*.92, s*.92)], fill=INK, width=w)


def qr(d, s):
    w = _lw(s); d.rectangle([s*.1, s*.1, s*.9, s*.9], fill=WHITE, outline=INK, width=w)
    for (x, y) in ((.16, .16), (.58, .16), (.16, .58)): d.rectangle([s*x, s*y, s*(x+.26), s*(y+.26)], outline=INK, width=w); d.rectangle([s*(x+.07), s*(y+.07), s*(x+.19), s*(y+.19)], fill=INK)
    for (x, y) in ((.58, .58), (.74, .62), (.62, .76), (.78, .78)): d.rectangle([s*x, s*y, s*(x+.1), s*(y+.1)], fill=PINK)


def arrow(d, s):
    w = _lw(s); d.polygon([(s*.1, s*.4), (s*.6, s*.4), (s*.6, s*.2), (s*.92, s*.5), (s*.6, s*.8), (s*.6, s*.6), (s*.1, s*.6)], fill=PINK); d.line([(s*.1, s*.4), (s*.6, s*.4), (s*.6, s*.2), (s*.92, s*.5), (s*.6, s*.8), (s*.6, s*.6), (s*.1, s*.6), (s*.1, s*.4)], fill=INK, width=w, joint="curve")


ICONS = {"printer3d": printer3d, "cube": cube, "gear": gear, "layers": layers, "spool": spool, "thermometer": thermometer, "check": check, "cross": cross,
         "warning": warning, "clock": clock, "money": money, "ruler": ruler, "bolt": bolt, "idea": idea, "truck": truck, "box": box, "phone": phone, "lock": lock,
         "star": star, "heart": heart, "person": person, "chart": chart, "qr": qr, "arrow": arrow}
KEYWORDS = [("printer3d", r"طابع|طباعة|printer|print"), ("spool", r"فيلمنت|خيط|filament|spool"), ("thermometer", r"حرار|temperature|°|nozzle|فوهة"), ("layers", r"طبقة|طبقات|layer"),
            ("cube", r"مجسم|ثلاثي|3d|model|stl|3mf"), ("money", r"سعر|أسعار|تكلفة|درهم|ريال|price|cost|aed|\$|usd"), ("clock", r"وقت|ساعة|ساعات|دقيق|time|hour|minute"),
            ("ruler", r"مقاس|قياس|أبعاد|مم|dimension|size|mm"), ("warning", r"تحذير|احذر|خطأ|مشكلة|فشل|warning|error|problem|fail"), ("check", r"صحيح|تأكد|ينجح|نجاح|check|correct|success"),
            ("idea", r"فكرة|نصيحة|tip|idea|trick"), ("truck", r"شحن|توصيل|delivery|shipping"), ("box", r"صندوق|تغليف|منتج|box|package|product"), ("phone", r"هاتف|جوال|phone|mobile"),
            ("lock", r"أمان|قفل|secure|lock"), ("bolt", r"سرعة|سريع|fast|speed|quick"), ("gear", r"ميكانيك|ترس|gear|mechanic|settings|إعدادات"), ("chart", r"إحصائ|نمو|chart|growth|stats"),
            ("qr", r"qr|nfc|باركود"), ("heart", r"حب|هدية|gift|love"), ("star", r"أفضل|مميز|best|premium"), ("person", r"عميل|شخص|customer|user")]


def render_icon(name: str, size: int) -> Image.Image:
    f = ICONS.get(name, cube); S = size * 4; im = Image.new("RGBA", (S, S), (0, 0, 0, 0)); f(ImageDraw.Draw(im), S)
    return im.resize((size, size), Image.LANCZOS)


def suggest(text: str):
    import re
    t = text.lower()
    return [n for n, rx in KEYWORDS if re.search(rx, t)]
