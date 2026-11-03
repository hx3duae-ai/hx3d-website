from pathlib import Path
from ..config import DATA, ROOT, BRAND
MEDIA = DATA / "media"; MEDIA.mkdir(parents=True, exist_ok=True)
ASPECTS = {"9:16": (1080, 1920), "16:9": (1920, 1080), "1:1": (1080, 1080), "4:5": (1080, 1350)}
PAL = {"paper": "#FBFBF7", "grid": "#D9E1E9", "ink": "#111111", "yellow": "#FFE14D", "pink": "#FF66B2", "black": "#050505", "white": "#FFFFFF"}
def rgb(h, a=255):
    h = h.lstrip("#"); return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)
