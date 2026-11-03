"""Script / images / 3D project -> editable storyboard (list of scenes). Rule-based and deterministic: no LLM, no network."""
from __future__ import annotations
import re
from .. import textgeo
from . import icons

TRANS = ["slide_up", "crossfade", "wipe", "slide_left"]
READ_WPS = 2.4   # words/second, spoken-pace ESTIMATE used only when no narration audio exists


def split_sentences(script: str):
    paras = [p.strip() for p in re.split(r"\n\s*\n", script.strip()) if p.strip()]
    if len(paras) > 1: return paras
    parts = [s.strip() for s in re.split(r"(?<=[\.\!\?؟。])\s+|\n", script.strip()) if s.strip()]
    out, cur = [], ""
    for s in parts:                                   # group short sentences into scenes of <= ~26 words
        if cur and len((cur + " " + s).split()) > 26: out.append(cur); cur = s
        else: cur = (cur + " " + s).strip()
    if cur: out.append(cur)
    return out


def est_duration(text: str, lo=2.8, hi=14.0):
    return round(min(hi, max(lo, len(text.split()) / READ_WPS + .8)), 2)


def shorten(text: str, n=7):
    w = re.split(r"[:،,\-–—]", text)[0].split(); return " ".join(w[:n]) + ("…" if len(w) > n else "")


def numbers(text: str):
    m = re.search(r"(\d[\d,\.]*)\s*(%|°|مم|ملم|سم|ساعة|ساعات|دقيقة|دقائق|درهم|ريال|aed|usd|\$|mm|cm|h|min|g|غرام)?", text, re.I)
    return (m.group(1) + (" " + m.group(2) if m.group(2) else "")).strip() if m else None


def vox_scene(i, text, n_total):
    items = [re.sub(r"^\s*[-•*\d]+[\.\)]?\s*", "", l).strip() for l in text.split("\n") if re.match(r"^\s*([-•*]|\d+[\.\)])\s+", l)]
    els = []; ic = icons.suggest(text); num = numbers(text)
    if items:
        head = text.split("\n")[0] if not re.match(r"^\s*([-•*]|\d+[\.\)])\s+", text.split("\n")[0]) else shorten(items[0])
        els = [{"type": "title", "text": shorten(head)}, {"type": "bullets", "items": items[:5]}]
        if ic: els.insert(1, {"type": "icon", "name": ic[0], "size": .2})
    else:
        els = [{"type": "title", "text": shorten(text, 8)}]
        if ic: els.append({"type": "icon", "name": ic[0], "size": .3})
        if num and re.search(r"\d", num): els.append({"type": "stat", "value": num.split()[0], "label": " ".join(num.split()[1:])})
        elif len(text.split()) > 9: els.append({"type": "text", "text": text if len(text) < 150 else shorten(text, 22)})
    return {"kind": "vox", "elements": els, "camera": {"type": "pan_down"}}


def from_script(script: str, template="vox", aspect="9:16", lang=None, brand_intro=True, outro=True, narrate=True):
    parts = split_sentences(script); scenes = []
    lang = lang or ("ar" if textgeo.is_arabic(script) else "en")
    if template == "vox" and brand_intro and parts:
        scenes.append({"id": "intro", "kind": "title_card", "narration": "", "caption": "", "min_duration": 1.6, "elements": [{"type": "title", "text": "HX 3D", "color": "#FF66B2", "highlight": False, "size": .16}],
                       "transition": {"type": "crossfade", "dur": .4}, "camera": {"type": "static"}, "tag": "intro"})
    for i, p in enumerate(parts):
        sc = vox_scene(i, p, len(parts)) if template == "vox" else {"kind": "title_card", "elements": [{"type": "title", "text": shorten(p, 10), "highlight": False}], "camera": {"type": "static"}}
        clean = re.sub(r"\s+", " ", re.sub(r"(?m)^\s*([-•*]|\d+[\.\)])\s+", "", p)).strip()
        sc.update({"id": f"s{i + 1}", "narration": clean if narrate else "", "caption": clean, "min_duration": 3.0, "transition": {"type": TRANS[i % len(TRANS)], "dur": .5}})
        sc["visual_suggestion"] = suggest_visual(p, template)
        scenes.append(sc)
    if template == "vox" and outro and parts:
        scenes.append({"id": "outro", "kind": "title_card", "narration": "", "caption": "", "min_duration": 2.2, "transition": {"type": "crossfade", "dur": .4}, "camera": {"type": "static"},
                       "elements": [{"type": "title", "text": "تابعنا" if lang == "ar" else "Follow HX 3D", "color": "#FFFFFF", "highlight": False}, {"type": "badge", "text": "@hx3d" , "color": "pink"}], "tag": "outro"})
    return {"template": template, "aspect": aspect, "lang": lang, "scenes": scenes}


def suggest_visual(text, template):
    ic = icons.suggest(text)
    return {"icons": ic[:3], "idea": ("2D flat illustration of " + ", ".join(ic[:2])) if ic else "clean typographic scene with a key stat or checklist",
            "camera": "smooth top-down pan over the paper grid" if template == "vox" else "slow zoom-in"}


def from_images(items, aspect="9:16", motion="auto", duration=3.2, caption_lang=None):
    """items = [{"path", "caption"?, "narration"?}] -> Ken-Burns scenes with alternating motion + transitions."""
    cams = ["zoom_in", "pan_right", "zoom_out", "pan_left"]; scenes = []
    for i, it in enumerate(items):
        cam = cams[i % 4] if motion == "auto" else motion
        els = [{"type": "badge", "text": it["caption"]}] if it.get("caption") else []
        scenes.append({"id": f"s{i + 1}", "kind": "image_motion", "image": it["path"], "narration": it.get("narration", ""), "caption": it.get("caption", ""), "min_duration": it.get("duration", duration),
                       "camera": {"type": cam, "amount": .16}, "elements": els, "anchor": "bottom", "transition": {"type": ["crossfade", "slide_left", "wipe"][i % 3], "dur": .5}})
    return {"template": "slideshow", "aspect": aspect, "lang": caption_lang or "ar", "scenes": scenes}


def from_model(project_id, title=None, aspect="9:16", seconds=8.0, bg="studio"):
    els = [{"type": "title", "text": title, "highlight": False}] if title else []
    return {"template": "turntable", "aspect": aspect, "lang": "ar", "scenes": [{"id": "s1", "kind": "turntable", "project_id": project_id, "narration": "", "caption": "", "min_duration": seconds, "bg": bg,
            "turns": .75, "elements": els, "anchor": "top", "camera": {"type": "orbit"}, "transition": {"type": "none", "dur": 0}}]}
