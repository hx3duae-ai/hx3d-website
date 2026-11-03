"""Smart Prompt Engine (template-based, deterministic, offline). Turns a short idea into a detailed prompt + shot plan for image/video engines.
It does not call an LLM; an LLM refinement hook can be added later (see backends.llm_spec)."""
from __future__ import annotations
import re
from .. import textgeo

INTENTS = {
    "product": dict(style="professional e-commerce product photography, sharp focus, true-to-life colours", light="soft diffused three-point studio lighting with a gentle rim light",
                    bg="seamless matte backdrop with subtle gradient", comp="centered hero composition, rule of thirds negative space for text", cam="50-85mm lens, f/5.6, slight 3/4 angle", move="slow orbit around the product"),
    "ad": dict(style="bold high-contrast advertising visual, clean graphic design", light="dramatic key light with colored accent glow", bg="dark brand backdrop with pink accent shapes",
               comp="strong focal product, headline space at top, call-to-action space at bottom", cam="35-50mm, shallow depth of field", move="push-in with parallax on the foreground"),
    "cinematic": dict(style="cinematic film still, anamorphic look, subtle film grain, rich color grade", light="moody low-key lighting, volumetric haze, warm/cool contrast", bg="layered depth with bokeh highlights",
                      comp="wide establishing shot, leading lines, 2.39:1 feel", cam="24-35mm anamorphic, f/2", move="slow dolly-in"),
    "educational": dict(style="flat 2D vector illustration on white grid paper, thick black outlines, yellow highlighter accents, pink highlights (VOX explainer style)", light="flat, no shadows", bg="white graph paper with light blue grid",
                        comp="clear hierarchy: title, icon, key number, short bullets", cam="top-down orthographic view", move="smooth top-down pan, elements pop in one by one"),
    "3d": dict(style="clean 3D render, soft global illumination, physically based materials", light="large softbox key + HDRI fill", bg="soft gradient studio floor with reflection", comp="isometric hero angle, generous margins", cam="orthographic or 50mm, slight top-down", move="turntable rotation"),
    "social": dict(style="eye-catching vertical social post, vibrant but on-brand", light="bright, even, high key", bg="brand pink/black graphic shapes", comp="9:16 safe zones, subject in the central 60%", cam="close-up, handheld energy", move="quick zoom + whip transition"),
}
KEY = [("educational", r"تعليم|شرح|كيف|نصيحة|خطوات|explain|how to|tutorial|tips|steps"), ("product", r"منتج|متجر|product|shop|store|catalog"), ("ad", r"إعلان|عرض|خصم|ad\b|advert|sale|promo|offer"),
       ("3d", r"3d|ثلاثي|مجسم|طباع|print"), ("cinematic", r"سينمائي|فيلم|cinematic|film|epic"), ("social", r"ريلز|reel|tiktok|story|ستوري|بوست|post")]


def detect(idea):
    return [k for k, rx in KEY if re.search(rx, idea, re.I)] or ["product"]


def enhance(idea: str, kind="image", intent=None, brand=True, aspect="9:16", negative=True):
    idea = idea.strip(); intents = [intent] if intent else detect(idea); main = INTENTS[intents[0]]; ar = textgeo.is_arabic(idea)
    parts = [f"{idea}", main["style"], main["light"], f"background: {main['bg']}", f"composition: {main['comp']}", f"camera: {main['cam']}"]
    if brand: parts.append("brand palette: black #050505, pink #FF66B2, white; clean modern typography space reserved")
    if kind == "video": parts.append(f"camera movement: {main['move']}; smooth, stable, no morphing, consistent subject, {aspect} frame")
    parts.append("ultra detailed, high quality")
    out = {"prompt": ", ".join(parts), "negative_prompt": "blurry, low quality, distorted, deformed, extra fingers, watermark, text artifacts, oversaturated" if negative else "",
           "intents": intents, "choices": {"lighting": main["light"], "background": main["bg"], "composition": main["comp"], "camera": main["cam"], "movement": main["move"]},
           "note": "Prompts for generative engines are written in English (best support); the Arabic idea is kept verbatim at the start." if ar else "Template-based; no AI rewriting."}
    if kind == "video": out["shot_plan"] = [{"shot": "establishing", "sec": 2, "move": main["move"]}, {"shot": "detail", "sec": 3, "move": "slow push-in"}, {"shot": "hero/CTA", "sec": 2, "move": "hold + subtle drift"}]
    return out
