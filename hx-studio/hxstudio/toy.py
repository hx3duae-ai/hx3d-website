"""Toy designer: articulated print-in-place robot template, verified with the skill's swept-collision verifier."""
from __future__ import annotations
import json, subprocess, sys, textwrap
from pathlib import Path
from .backends import SKILL_SCRIPTS
from .config import MATERIALS
from .meshutil import Part

TEMPLATE = '''
import sys
sys.path.insert(0, r"{scripts}")
from build123d import Box, Pos
from hx_lib import captive_pin
C = {colors!r}
CL = {clearance}
def build():
    GAP = 0.4
    torso = Pos(0, 0, 33) * Box(20, 14, 22) + Pos(0, 0, 15.5) * Box(14, 12, 13)
    head_blk = Pos(0, 0, 44 + GAP + 8) * Box(18, 14, 16)
    eye_l = Pos(-4, -7 + 0.6, 56) * Box(3, 1.2, 3.5); eye_r = Pos(4, -7 + 0.6, 56) * Box(3, 1.2, 3.5)
    head = head_blk - eye_l - eye_r
    neck_pin, neck_cut, _ = captive_pin((0, 0, 44), (0, 0, 1), clearance=CL)
    torso = torso - neck_cut; head = head + neck_pin
    arms, legs, joints = {{}}, {{}}, []
    for side, s in (("left", -1), ("right", 1)):
        pin, cut, _ = captive_pin((s * 10, 0, 40), (s, 0, 0), clearance=CL); torso = torso - cut
        arms[side] = Pos(s * (10 + GAP + 2.5), 0, 34) * Box(5, 8, 17) + pin
        joints.append({{"name": side + "_shoulder", "parent": "torso", "child": side + "_arm", "origin": (s * 10, 0, 40), "axis": (1, 0, 0), "range_deg": (-60, 60)}})
        pin, cut, _ = captive_pin((s * 7, 0, 12), (s, 0, 0), clearance=CL); torso = torso - cut
        legs[side] = Pos(s * (7 + GAP + 4), 0, 9.5) * Box(8, 10, 19) + pin
        joints.append({{"name": side + "_hip", "parent": "torso", "child": side + "_leg", "origin": (s * 7, 0, 12), "axis": (1, 0, 0), "range_deg": (-30, 30)}})
    joints.append({{"name": "neck", "parent": "torso", "child": "head", "origin": (0, 0, 44), "axis": (0, 0, 1), "range_deg": (-40, 40)}})
    parts = [{{"name": "torso", "group": "torso", "color": C["body"], "shape": torso}},
             {{"name": "head_shell", "group": "head", "color": C["head"], "shape": head}},
             {{"name": "eye_l", "group": "head", "color": C["eyes"], "shape": eye_l}}, {{"name": "eye_r", "group": "head", "color": C["eyes"], "shape": eye_r}},
             {{"name": "left_arm", "group": "left_arm", "color": C["arms"], "shape": arms["left"]}}, {{"name": "right_arm", "group": "right_arm", "color": C["arms"], "shape": arms["right"]}},
             {{"name": "left_leg", "group": "left_leg", "color": C["legs"], "shape": legs["left"]}}, {{"name": "right_leg", "group": "right_leg", "color": C["legs"], "shape": legs["right"]}}]
    return {{"parts": parts, "joints": joints, "fused": []}}
'''


def robot(workdir, colors=None, material="PLA", step=15.0, progress=None):
    if not SKILL_SCRIPTS.exists(): raise RuntimeError("HX-3D-Image-to-3MF skill scripts not found; toy verifier unavailable")
    c = {"body": "#e8702a", "head": "#e8702a", "eyes": "#111111", "arms": "#f2f2f2", "legs": "#6b7280", **(colors or {})}
    wd = Path(workdir); wd.mkdir(parents=True, exist_ok=True)
    (wd / "model.py").write_text(TEMPLATE.format(scripts=str(SKILL_SCRIPTS), colors=c, clearance=MATERIALS[material]["clearance"] + 0.05))
    (wd / "reconstruction.json").write_text(json.dumps({"exact_reconstruction_claimed": False, "confidence": "template character, not derived from a photo",
        "observed": ["user-chosen colours"], "inferred": ["all geometry is a fixed blocky template"], "unknown": ["any resemblance to a specific reference image"]}))
    if progress: progress(10, "verifying joints (swept collision)...")
    r = subprocess.run([sys.executable, str(SKILL_SCRIPTS / "verify.py"), str(wd / "model.py"), str(wd), "--step", str(step)], capture_output=True, text=True, timeout=1800)
    ver = json.loads((wd / "verify.json").read_text())
    sys.path.insert(0, str(SKILL_SCRIPTS))
    try:
        import hx_lib
        spec = hx_lib.load_model(str(wd / "model.py")); meshes = hx_lib.meshes_from_spec(spec)
    finally: sys.path.remove(str(SKILL_SCRIPTS))
    parts = [Part(p["name"], meshes[p["name"]], p["color"], p["group"], meta={"object": p["group"]}) for p in spec["parts"]]
    info = {"verify_passed": ver["passed"], "checks": len([x for x in ver["checks"]]), "joint_sweep": ver["joint_sweep"], "stdout": r.stdout[-600:],
            "notes": ["Fixed blocky robot template (60 mm). Print in place; free each joint by flexing once.", "Joint clearance %.2f mm for %s (estimate; confirm with a print)." % (MATERIALS[material]["clearance"] + 0.05, material)]}
    return parts, info, {"passed": ver["passed"], "checks": [c for c in ver["checks"] if not c["ok"]]}
