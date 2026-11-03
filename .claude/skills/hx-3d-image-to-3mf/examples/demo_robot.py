"""Worked example: a 60 mm toy robot, 4 colours, 5 print-in-place captive-pin joints.
Copy this as the template for model.py. Print pose: Z up, feet on Z=0."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from build123d import Box, Pos
from hx_lib import captive_pin

ORANGE, WHITE, BLACK, GREY = "#e8702a", "#f2f2f2", "#111111", "#6b7280"


def build():
    GAP = 0.4
    # torso (orange) + pelvis
    torso = Pos(0, 0, 33) * Box(20, 14, 22) + Pos(0, 0, 15.5) * Box(14, 12, 13)
    # head (orange) with eye pockets filled by black inlays
    head_blk = Pos(0, 0, 44 + GAP + 8) * Box(18, 14, 16)
    eye_l = Pos(-4, -7 + 0.6, 56) * Box(3, 1.2, 3.5)
    eye_r = Pos(4, -7 + 0.6, 56) * Box(3, 1.2, 3.5)
    head = head_blk - eye_l - eye_r
    # neck joint: axis +Z out of torso top
    neck_pin, neck_cut, _ = captive_pin((0, 0, 44), (0, 0, 1))
    torso = torso - neck_cut
    head = head + neck_pin
    # shoulders: axis +/-X out of the torso sides at z=40
    arms, joints = {}, []
    legs = {}
    for side, s in (("left", -1), ("right", 1)):
        pin, cut, _ = captive_pin((s * 10, 0, 40), (s, 0, 0))
        torso = torso - cut
        arm = Pos(s * (10 + GAP + 2.5), 0, 34) * Box(5, 8, 17) + pin
        arms[side] = arm
        joints.append({"name": f"{side}_shoulder", "parent": "torso", "child": f"{side}_arm",
                       "origin": (s * 10, 0, 40), "axis": (1, 0, 0), "range_deg": (-60, 60)})
        pin, cut, _ = captive_pin((s * 7, 0, 12), (s, 0, 0))
        torso = torso - cut
        leg = Pos(s * (7 + GAP + 4), 0, 9.5) * Box(8, 10, 19) + pin
        legs[side] = leg
        joints.append({"name": f"{side}_hip", "parent": "torso", "child": f"{side}_leg",
                       "origin": (s * 7, 0, 12), "axis": (1, 0, 0), "range_deg": (-30, 30)})
    joints.append({"name": "neck", "parent": "torso", "child": "head",
                   "origin": (0, 0, 44), "axis": (0, 0, 1), "range_deg": (-40, 40)})
    parts = [
        {"name": "torso", "group": "torso", "color": ORANGE, "shape": torso},
        {"name": "head_shell", "group": "head", "color": ORANGE, "shape": head},
        {"name": "eye_l", "group": "head", "color": BLACK, "shape": eye_l},
        {"name": "eye_r", "group": "head", "color": BLACK, "shape": eye_r},
        {"name": "left_arm", "group": "left_arm", "color": WHITE, "shape": arms["left"]},
        {"name": "right_arm", "group": "right_arm", "color": WHITE, "shape": arms["right"]},
        {"name": "left_leg", "group": "left_leg", "color": GREY, "shape": legs["left"]},
        {"name": "right_leg", "group": "right_leg", "color": GREY, "shape": legs["right"]},
    ]
    return {"parts": parts, "joints": joints, "fused": []}
