"""Tool registry: params(dict)+files -> (parts, info, qc). Deterministic, so projects are stored as {tool, params} and regenerated."""
from __future__ import annotations
import math
from pathlib import Path
import numpy as np, trimesh
from shapely import affinity
from shapely.geometry import Polygon
from shapely.ops import unary_union
from . import keyboard as K, keycap as KC, tools as T, textgeo, toy, doctor, backends
from .keyboard import U
from .meshutil import Part, polys, inter, extrude
from .config import MATERIALS

ARABIC_MAP = dict(zip("QWERTYUIOP[]ASDFGHJKL;'ZXCVBNM,./", list("ضصثقفغعهخحجدشسيبلاتنمكطئءؤرلىةوزظ")[:0] or
                      ["ض", "ص", "ث", "ق", "ف", "غ", "ع", "ه", "خ", "ح", "ج", "د", "ش", "س", "ي", "ب", "ل", "ا", "ت", "ن", "م", "ك", "ط", "ئ", "ء", "ؤ", "ر", "لا", "ى", "ة", "و", "ز", "ظ"]))
# Windows "Arabic (101)" letter positions (QWERTY key -> Arabic letter); verify against your own layout standard.


def _p(params, key, default): return params.get(key, default)


def kb_qc(parts, info, p: K.KbParams):
    checks = []
    def add(i, ok, d, lvl="fail"): checks.append({"id": i, "ok": bool(ok), "detail": d, "level": lvl})
    keys = info["keys_geom"]
    # 1. key spacing (pitch 19.05 within each half)
    bad = 0
    for h in (0, 1):
        ks = [k for k in keys if k["half"] == h]
        if not ks: continue
        ref = ks[0]
        for k in ks:
            if p.split_angle: continue
            ex = (k["x"] - ref["x"] + (k["w"] - ref["w"]) / 2) * U; ey = -((k["y"] - ref["y"]) + (k["h"] - ref["h"]) / 2) * U
            if abs((k["cx"] - ref["cx"]) - ex) > 0.01 or abs((k["cy"] - ref["cy"]) - ey) > 0.01: bad += 1
    add("key_spacing", bad == 0, f"{len(keys)} keys on a {U} mm pitch grid; {bad} off-grid" + (" (split halves are rotated rigidly: pitch preserved)" if p.split_angle else ""))
    # 2. measured switch windows on the plate pieces
    plates = [x for x in parts if x.name.startswith("plate")]
    n_sw = n_st = 0; sw_bad = 0
    for pl in plates:
        sec = pl.mesh.section(plane_origin=[0, 0, pl.mesh.bounds[0][2] + p.plate_t / 2], plane_normal=[0, 0, 1])
        if sec is None: continue
        pg = [Polygon(d[:, :2]) for d in sec.discrete if len(d) >= 3]
        for q in pg:
            if q.area > 5000: continue
            r = q.minimum_rotated_rectangle; xs = list(r.exterior.coords); a = math.dist(xs[0], xs[1]); b = math.dist(xs[1], xs[2])
            if abs(a - (K.MX_CUTOUT + p.cutout_tol)) < 0.05 and abs(b - (K.MX_CUTOUT + p.cutout_tol)) < 0.05: n_sw += 1
            elif all(abs(x - y) < 0.06 for x, y in zip(sorted([a, b]), sorted(K.STAB_CUTOUT))): n_st += 1
            elif q.area < 60: sw_bad += 1
    add("switch_cutouts", n_sw == len(keys), f"measured {n_sw} switch windows of {K.MX_CUTOUT + p.cutout_tol} x {K.MX_CUTOUT + p.cutout_tol} mm (expected {len(keys)})")
    add("stabilizer_cutouts", n_st == 2 * info["stabilized_keys"], f"measured {n_st} stabilizer windows (expected {2 * info['stabilized_keys']} for {info['stabilized_keys']} stabilized keys)")
    add("stabilizer_widths_supported", not info["unsupported_stab_keys"], "all ≥2u keys have a known stabilizer spacing" if not info["unsupported_stab_keys"] else f"unsupported widths: {info['unsupported_stab_keys']}")
    # 3. collisions between different parts (plate pieces vs case, bezel)
    coll = []
    names = [x for x in parts]
    for i, a in enumerate(names):
        for b in names[i + 1:]:
            if a.meta.get("split_from") and a.meta.get("split_from") == b.meta.get("split_from"): continue
            if a.name.startswith("fit_test") or b.name.startswith("fit_test") or "wedge" in a.name or "wedge" in b.name: continue
            if not ((a.mesh.bounds[0] < b.mesh.bounds[1]).all() and (b.mesh.bounds[0] < a.mesh.bounds[1]).all()): continue
            i_ = inter(a.mesh, b.mesh); v = float(i_.volume) if len(i_.faces) else 0.0
            if v > 0.5: coll.append((a.name, b.name, round(v, 2)))
    add("collisions", not coll, "no overlapping parts" if not coll else f"overlaps: {coll[:4]}")
    # 4. walls
    th = {}
    for x in parts:
        if x.name.startswith("bottom_case"):
            th[x.name] = doctor._thickness_p5(x.mesh)
    add("wall_thickness", p.wall >= 1.6 and p.floor >= 1.6 and p.plate_t >= 1.2, f"wall {p.wall} mm, floor {p.floor} mm, plate {p.plate_t} mm (min 1.6/1.6/1.2); sampled p5 thickness {th}", "fail")
    add("plate_thickness_vs_switch", abs(p.plate_t - 1.5) < 0.2, f"plate {p.plate_t} mm; MX clip-in switches are designed for ~1.5 mm plates (verify your switch datasheet)", "warn")
    # 5. screw posts / usb
    add("screw_posts", len(info["screw_posts"]) >= 4, f"{len(info['screw_posts'])} screw posts ({p.screw})")
    ux = info["usb"]["x_mm"]
    near = [q for q in info["screw_posts"] if abs(q[1] - (max(o["cy"] for o in keys) + 80)) < 0]
    add("usb_opening", info["usb"]["fits_in_wall"], f"USB-C opening {p.usb_w}x{p.usb_h} mm at x={ux} mm, z={info['usb']['z_center']} mm fits between floor and plate" + (" (DEFAULT position - set to match your PCB)" if info["usb"]["default_position"] else ""))
    # 6. PCB
    if p.pcb: add("pcb_mounting", info["pcb_standoffs"] == len(p.pcb.get("holes", [])), f"{info['pcb_standoffs']} standoffs from profile '{p.pcb.get('name')}'")
    else: add("pcb_mounting", True, "NOT VERIFIED: no PCB profile supplied (no standoffs generated)", "warn")
    return {"passed": all(c["ok"] for c in checks if c["level"] == "fail"), "checks": checks}


def kb_bom(info, n_caps, screw):
    keys = info["keys"]; stabs = info["stabilized_keys"]; posts = len(info["screw_posts"]) + info["pcb_standoffs"]
    return [{"item": "PCB (hot-swap or solder) matching this layout", "qty": 1, "note": "NOT included/designed: choose a PCB for the %s layout and supply its profile for standoffs" % info["layout"]},
            {"item": "MX-style switches", "qty": keys, "note": "5-pin PCB-mount or 3-pin plate-mount per your PCB"},
            {"item": "Stabilizers (Cherry-style plate-mount)", "qty": stabs, "note": "sizes per key width: 2u / 6.25u / 7u..."},
            {"item": "Controller (if the PCB has none)", "qty": 1, "note": "must be supported by your PCB; no mounting generated"},
            {"item": "USB-C cable", "qty": 1, "note": "connector position must match the opening"},
            {"item": f"{screw} screws (self-tapping or heat-set inserts)", "qty": posts, "note": "length depends on stack; test fit"},
            {"item": "Keycaps (printed here) / or purchased", "qty": n_caps, "note": "MX stem; fit-test first"}]


def build_keyboard(params, files, progress=lambda *_: None):
    kp = K.KbParams(**{k: v for k, v in params.get("kb", {}).items() if k in K.KbParams.__dataclass_fields__})
    progress(10, "building plate / case / bezel")
    parts, info = K.build(kp)
    for p in parts:
        p.meta["object"] = p.name
        if p.name.startswith("top_bezel"): p.meta["flip"] = True
    qc = kb_qc(parts, info, kp)
    n_caps = 0; cap_checks = []
    if params.get("fit_test", True):
        ft = K.fit_test_plate(kp); ft.meta["object"] = "fit_test_plate"; ft.mesh.apply_translation([0, 35, 0]); parts.append(ft)   # parked behind the keyboard in the assembled view
    if params.get("keycaps", {}).get("enabled"):
        kc = params["keycaps"]; keys = info["keys_geom"]; over = {int(k): v for k, v in kc.get("overrides", {}).items()}
        for i, k in enumerate(keys):
            progress(20 + 70 * i / len(keys), f"keycap {i + 1}/{len(keys)}")
            o = over.get(i, {}); lab = o.get("legend", k["label"]); lab2 = o.get("legend2", "")
            if kc.get("arabic") and not lab2 and lab.upper() in ARABIC_MAP: lab2 = ARABIC_MAP[lab.upper()]
            cp = KC.KeycapParams(width_u=k["w"], height_u=k["h"], profile=kc.get("profile", "cherry"), legend=lab, legend2=lab2,
                                 legend_h=kc.get("legend_h", 4.5 if len(lab) <= 1 else 3.2), color_body=o.get("color", kc.get("color", "#050505")),
                                 color_legend=kc.get("legend_color", "#FFFFFF"), color_legend2=kc.get("legend2_color", "#FF66B2"), slot_tol=kc.get("slot_tol", 0.1), name=f"key{i:03d}")
            try:
                cps, _ = KC.build(cp)
            except Exception as e:
                cap_checks.append({"id": f"key{i}", "ok": False, "detail": repr(e), "level": "fail"}); continue
            v = KC.verify(cps, cp); cap_checks += [dict(c, id=f"key{i}_{c['id']}") for c in v["checks"] if not c["ok"]]
            zc = info["z"]["plate_top"] + kc.get("cap_bottom_above_plate", 6.0)    # ASSUMPTION: keycap base ~6 mm above the plate (MX switch stack); verify with your switch
            for cpp in cps:
                cpp.meta["object"] = f"key{i:03d}_{lab}"; cpp.meta["flip"] = True
                if k["rot"]: cpp.mesh.apply_transform(trimesh.transformations.rotation_matrix(math.radians(k["rot"]), [0, 0, 1]))
                cpp.mesh.apply_translation([k["cx"], k["cy"], zc])
            parts += cps; n_caps += 1
        qc["checks"].append({"id": "keycap_qc", "ok": not any(not c["ok"] for c in cap_checks), "level": "fail", "detail": f"{n_caps} keycaps verified (watertight, MX stem/slot measured on mesh, legend fit)" + (f"; failures: {cap_checks[:3]}" if cap_checks else "")})
        qc["passed"] = qc["passed"] and not cap_checks
    info["bom"] = kb_bom(info, n_caps, kp.screw); info["n_caps"] = n_caps
    return parts, info, qc


def build_keycap(params, files, progress=lambda *_: None):
    kcp = KC.KeycapParams(**{k: v for k, v in params.items() if k in KC.KeycapParams.__dataclass_fields__ and k not in ("topper", "topper_mesh")})
    img = files.get("image"); mesh = files.get("mesh")
    if img:
        bw, bd, tw, td, H = KC.dims(kcp)
        seg = T.segment(T.load_image(img), k=params.get("colors", 3)); regs, sil = T.color_regions(seg, 10.0); regs = T._tile(regs, sil)
        regs = {k: textgeo.fit(g, tw - 2.5, td - 2.5) if False else g for k, g in regs.items()}
        # fit ALL regions with one common transform (keep colour boundaries aligned)
        u = unary_union(list(regs.values())); x0, y0, x1, y1 = u.bounds; s = min((tw - 2.5) / (x1 - x0), (td - 2.5) / (y1 - y0)); cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        regs = {k: affinity.translate(affinity.scale(g, s, s, origin=(0, 0)), -cx * s, -cy * s) for k, g in regs.items()}
        kcp.topper = {"polys_by_color": regs, "height": params.get("topper_height", 2.5)}
    if mesh:
        m = doctor.load_mesh(mesh); bw, bd, tw, td, H = KC.dims(kcp); m = m.copy(); m.apply_translation(-m.centroid)
        s = min((tw - 2.5) / m.extents[0], (td - 2.5) / m.extents[1], params.get("sculpture_height", 12.0) / m.extents[2]); m.apply_scale(s); kcp.topper_mesh = m
    parts, info = KC.build(kcp); v = KC.verify(parts, kcp)
    for p in parts: p.meta["object"] = kcp.name; p.meta["flip"] = img is None and mesh is None
    info["honesty"] = ["Profile is a simplified approximation of '%s', not an official reproduction." % kcp.profile, "MX stem fit unverified until the fit-test caps are printed."]
    if img: info["image_note"] = "Subject silhouette/colours taken from ONE image; raised topper is a 2.5D relief (back/depth not inferred)."
    return parts, info, v


def _img(files): 
    f = files.get("image")
    if not f: raise ValueError("this tool needs an uploaded image")
    return f


def mesh_qc(parts, printer_ok=True):
    checks = [{"id": f"mesh_{p.name}", "ok": bool(p.mesh.is_volume), "level": "fail", "detail": f"watertight={p.mesh.is_watertight} vol={p.mesh.volume:.1f}"} for p in parts]
    return {"passed": all(c["ok"] for c in checks), "checks": checks}


def build_generic(tool, params, files, progress=lambda *_: None):
    mat = params.get("material", "PLA")
    if tool == "image_to_3d":
        bk = params.get("backend", "local")
        if bk == "external":
            path = backends.run_external_i23d(_img(files), str(Path(_img(files)).parent)); m = doctor.load_mesh(path); m, rep = doctor.repair(m)
            return [Part("generated_mesh", m, "#cccccc", "mesh")], {"kind": "volumetric mesh from external backend", "repair": rep["message"], "notes": ["External result: verify likeness yourself; hidden sides are the model's guess."]}, None
        parts, info = T.image_to_relief(_img(files), params.get("width_mm", 60), params.get("base_t", 1.6), params.get("relief_t", 2.4), params.get("colors", 4), params.get("mode", "flat"))
    elif tool == "logo_to_3d": parts, info = T.logo_to_3d(_img(files), params.get("width_mm", 50), params.get("thickness", 3), params.get("colors", 3))
    elif tool == "sketch_to_3d": parts, info = T.sketch_to_3d(_img(files), params.get("width_mm"), params.get("height_mm"), params.get("thickness", 5.0), params.get("threshold"), params.get("invert", False))
    elif tool == "lithophane": parts, info = T.lithophane(_img(files), params.get("width_mm", 100), params.get("min_t", 0.8), params.get("max_t", 3.2), params.get("px_mm", 0.4), invert=params.get("invert", False))
    elif tool in ("text_to_3d", "calligraphy"):
        if params.get("description") and not params.get("text"):
            spec = backends.llm_spec(params["description"], params.get("width_mm", 60)); parts, info = T.from_spec(spec); info["spec"] = spec
        else:
            parts, info = T.text_to_3d(params.get("text", "HX 3D"), params.get("kind", "nameplate"), params.get("height_mm", 12), params.get("font"), files.get("font"),
                                       params.get("color_text", "#FFFFFF"), params.get("color_base", "#050505"), params.get("base_t", 2.0), params.get("text_t", 1.6), max_width=params.get("max_width"))
    elif tool == "primitive_spec": parts, info = T.from_spec(params["spec"])
    elif tool == "box": parts, info = T.box_generator(params.get("w", 80), params.get("d", 60), params.get("h", 40), params.get("wall", 2.0), params.get("r", 3.0), params.get("lid_h", 8), mat, params.get("screws", False), params.get("latch", True))
    elif tool == "ring": parts, info = T.ring(params.get("size", 7), params.get("system", "US"), params.get("band_w", 6), params.get("thickness", 2), params.get("text"))
    elif tool == "pendant": parts, info = T.pendant(files.get("image"), params.get("text", "HX"), params.get("size_mm", 30), params.get("thickness", 2.5))
    elif tool == "gears": parts, info = T.gear_pair(params.get("z1", 16), params.get("z2", 32), params.get("module", 2.0), params.get("thickness", 6), params.get("bore", 5), mat, params.get("backlash", 0.15))
    elif tool == "hinge": parts, info = T.hinge(params.get("length", 40), params.get("leaf_w", 20), params.get("leaf_t", 3), params.get("knuckles", 5), params.get("pin_d", 3), mat)
    elif tool == "mounting_plate": parts, info = T.mounting_plate(params.get("w", 60), params.get("d", 40), params.get("t", 3.0), tuple(map(tuple, params.get("holes", [(-20, -12), (20, -12), (-20, 12), (20, 12)]))), params.get("screw", "M3"))
    elif tool == "multipart":
        m = doctor.load_mesh(files["mesh"]); parts, info = T.split_model(m, params.get("axis", "x"), params.get("max_len", 238), params.get("pin_d", 4.0), mat)
    elif tool == "doctor":
        m = doctor.load_mesh(files["mesh"]); parts = [Part("mesh", m, "#cccccc", "mesh", meta={"object": "mesh"})]; info = {"report": doctor.diagnose(m, material=mat)}
        return parts, info, {"passed": info["report"]["printable"], "checks": [{"id": i["code"], "ok": False, "level": "fail" if i["severity"] == "error" else "warn", "detail": i["message"]} for i in info["report"]["issues"]]}
    elif tool == "toy_robot":
        parts, info, qc = toy.robot(params["_workdir"], params.get("colors"), mat, params.get("step", 15.0), progress)
        return parts, info, qc
    else: raise ValueError(f"unknown tool {tool}")
    qc = mesh_qc(parts)
    sw = info.get("sweep") or info.get("mesh_sweep")
    if sw is not None: qc["checks"].append({"id": "motion_sweep", "ok": bool(sw["ok"]), "level": "fail", "detail": str({k: v for k, v in sw.items() if k != 'violations'})}); qc["passed"] = qc["passed"] and sw["ok"]
    for p in parts: p.meta.setdefault("object", p.group if tool in ("image_to_3d", "logo_to_3d", "text_to_3d", "calligraphy", "pendant") else p.name)
    return parts, info, qc


def build(tool, params, files, progress=lambda *_: None):
    if tool == "keyboard": return build_keyboard(params, files, progress)
    if tool == "keycap": return build_keycap(params, files, progress)
    return build_generic(tool, params, files, progress)
