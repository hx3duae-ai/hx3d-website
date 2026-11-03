"""Pluggable AI backends + honest capability report. Nothing is reported 'ready' unless it can actually run now."""
from __future__ import annotations
import json, os, shutil, subprocess, tempfile
from pathlib import Path
from .config import ROOT

SKILL_SCRIPTS = ROOT.parent / ".claude" / "skills" / "hx-3d-image-to-3mf" / "scripts"


def image_to_3d_backend():
    """External volumetric image-to-3D (AssetFurnace / TripoSG / TRELLIS / image-to-3d-studio ...) via HX_I23D_CMD."""
    cmd = os.environ.get("HX_I23D_CMD")
    return {"id": "external_i23d", "status": "ready" if cmd else "needs_backend",
            "requires": "Set HX_I23D_CMD='<command with {image} and {out_dir}>' that writes mesh.glb|obj|stl|ply into {out_dir}.",
            "note": "AssetFurnace's interface is not public/known to this build; any CLI wrapper works."}


def run_external_i23d(image_path: str, workdir: str):
    cmd = os.environ.get("HX_I23D_CMD")
    if not cmd: raise RuntimeError("HX_I23D_CMD is not configured: no volumetric image-to-3D backend available")
    out = Path(workdir) / "backend"; out.mkdir(parents=True, exist_ok=True)
    r = subprocess.run(cmd.format(image=image_path, out_dir=str(out)), shell=True, capture_output=True, text=True, timeout=3600)
    ms = [p for e in ("glb", "obj", "stl", "ply") for p in out.glob(f"mesh.{e}")]
    if r.returncode != 0 or not ms: raise RuntimeError(f"backend failed (rc={r.returncode}): {r.stderr[-400:]}")
    return str(ms[0])


def llm_spec(description: str, width_mm: float = 60.0):
    """Description (Arabic/English) -> primitive-assembly JSON spec via an LLM. Needs ANTHROPIC_API_KEY. NOT exercised in the test-suite."""
    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key: raise RuntimeError("ANTHROPIC_API_KEY not set: free-form text-to-3D needs an LLM backend")
    import anthropic
    client = anthropic.Anthropic(api_key=key)
    sys_p = ("You design simple 3D-printable models as JSON. Output ONLY JSON: {\"parts\":[{\"name\":str,\"shape\":\"box|cylinder|sphere|cone|capsule|text\","
             "\"size\":[numbers mm],\"pos\":[x,y,z],\"rot\":[deg,deg,deg],\"color\":\"#rrggbb\",\"op\":\"add|cut\",\"group\":str}]}. box size=[x,y,z]; cylinder=[diameter,height]; sphere=[dx,dy,dz]; "
             "cone=[diameter,height]; capsule=[diameter,length]; text needs \"text\" and size=[height,max_width,thickness]. Keep parts overlapping so the model is one connected body per colour. Overall width about %s mm." % width_mm)
    msg = client.messages.create(model=os.environ.get("HX_LLM_MODEL", "claude-sonnet-5-5"), max_tokens=4000, system=sys_p, messages=[{"role": "user", "content": description}])
    txt = msg.content[0].text; txt = txt[txt.index("{"): txt.rindex("}") + 1]
    return json.loads(txt)


def capabilities():
    skill = SKILL_SCRIPTS.exists()
    llm = bool(os.environ.get("ANTHROPIC_API_KEY"))
    i23 = image_to_3d_backend()
    R = lambda ok, need="": {"status": "ready" if ok else "needs_backend", "requires": need}
    return {
        "image_to_3d": {"local": {"status": "ready", "what": "2.5D multicolour relief from one image (honest limits listed per result)"},
                        "volumetric": i23},
        "toy_designer": {"local_template": {"status": "ready" if skill else "unavailable", "what": "articulated print-in-place robot template with verified joints (uses the HX-3D-Image-to-3MF verifier)"},
                         "from_image": {"status": "needs_backend", "requires": "volumetric image-to-3D backend + a modelling pass (see skill hx-3d-image-to-3mf); not automatic"}},
        "color_match": {"status": "ready"}, "mechanical": {"status": "ready", "what": "gears, print-in-place hinge, mounting plates"},
        "optimizer": {"status": "ready"}, "doctor": {"status": "ready"}, "repair": {"status": "ready"},
        "text_to_3d": {"text_plates": {"status": "ready"}, "free_form_description": {"status": "ready" if llm else "needs_backend", "requires": "ANTHROPIC_API_KEY (primitive-assembly spec via LLM); or edit the JSON spec by hand"}},
        "sketch_to_3d": {"status": "ready", "limits": "outline extrusion; dimensions in the drawing are not read (enter mm manually)"},
        "keyboard": {"status": "ready", "limits": "mechanical geometry; PCB-specific features only from a user-supplied PCB profile"},
        "keycaps": {"status": "ready"}, "logo_to_3d": {"status": "ready"}, "calligraphy": {"status": "ready", "what": "Arabic shaping with Amiri (OFL); custom TTF upload for other styles"},
        "lithophane": {"status": "ready"}, "jewelry": {"status": "ready"}, "box": {"status": "ready"}, "multipart": {"status": "ready"},
        "business": {"status": "ready"}, "export": {"status": "ready", "limits": "validated by lib3mf re-read; Bambu Studio itself not available in the build environment"},
        "printer": {"default": "bambu_p2s", "build_volume_is_assumption": True},
    }
