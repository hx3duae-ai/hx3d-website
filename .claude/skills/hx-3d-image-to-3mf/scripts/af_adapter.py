"""Stage 2 (optional): image -> reference mesh via an external image-to-3D / rigging backend.

AssetFurnace could NOT be located publicly while building this skill (no website or docs found,
so its real interface is unknown). This adapter therefore does not pretend to speak its protocol.
Configure the backend yourself with ONE environment variable holding a shell command template:

    export HX_I23D_CMD='assetfurnace-cli generate --image {image} --out {out_dir} --rig'

The command must write into {out_dir}:  mesh.glb|obj|stl|ply  (required)
                                        rig.json (optional: {"bones":[{"name","head":[x,y,z],"tail":[..],"parent"}]})
Any other backend (e.g. the local image-to-3d-studio service) can be wrapped the same way.

    python af_adapter.py ref.png OUT_DIR
Exit 0 + backend_report.json {"status":"ok"} when a mesh came back, exit 3 {"status":"unavailable"} otherwise.
The mesh is only a PROPORTION/SHAPE GUIDE; the printed model is rebuilt parametrically.
"""
import json, os, subprocess, sys
from pathlib import Path


def main():
    image, out = Path(sys.argv[1]), Path(sys.argv[2]); out.mkdir(parents=True, exist_ok=True)
    cmd = os.environ.get("HX_I23D_CMD")
    rep = out / "backend_report.json"
    if not cmd:
        rep.write_text(json.dumps({"status": "unavailable",
            "reason": "HX_I23D_CMD not set; AssetFurnace not configured. Falling back to Claude-driven parametric reconstruction."}, indent=2))
        print(rep.read_text()); sys.exit(3)
    gdir = out / "backend"; gdir.mkdir(exist_ok=True)
    r = subprocess.run(cmd.format(image=image, out_dir=gdir), shell=True, capture_output=True, text=True, timeout=1800)
    meshes = [p for e in ("glb", "obj", "stl", "ply") for p in gdir.glob(f"mesh.{e}")]
    if r.returncode != 0 or not meshes:
        rep.write_text(json.dumps({"status": "failed", "returncode": r.returncode,
                                   "stderr_tail": r.stderr[-800:]}, indent=2))
        print(rep.read_text()); sys.exit(3)
    import trimesh
    m = trimesh.load(meshes[0], force="mesh")
    info = {"status": "ok", "mesh": str(meshes[0]), "bounds": m.bounds.round(2).tolist(),
            "extents": m.extents.round(2).tolist(), "triangles": int(len(m.faces)),
            "watertight": bool(m.is_watertight), "rig": (gdir / "rig.json").exists(),
            "note": "guide only - never treat as exact; hidden sides are model inference"}
    rep.write_text(json.dumps(info, indent=2)); print(rep.read_text())

if __name__ == "__main__":
    main()
