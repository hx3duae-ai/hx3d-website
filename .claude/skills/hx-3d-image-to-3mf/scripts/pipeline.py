"""Orchestrator. Stages: analyse | check | preview | export | docs | all

    python pipeline.py analyse REF.png OUT          # palette + optional backend mesh
    python pipeline.py check   MODEL.py OUT         # verify.py
    python pipeline.py preview MODEL.py OUT --ref REF.png
    python pipeline.py export  MODEL.py OUT --preview-reviewed
    python pipeline.py docs    MODEL.py OUT --ref REF.png
    python pipeline.py all     MODEL.py OUT --ref REF.png --preview-reviewed   # check->preview->export->docs, stops at first failure
Final deliverables are copied to OUT/deliverables/.
"""
import shutil, subprocess, sys
from pathlib import Path
H = Path(__file__).parent

def run(script, *args):
    r = subprocess.run([sys.executable, str(H / script), *map(str, args)]); return r.returncode

def main():
    st, a = sys.argv[1], sys.argv[2:]
    flags = [x for x in a if x.startswith("--")]
    pos = [x for x in a if not x.startswith("--")]
    ref = a[a.index("--ref") + 1] if "--ref" in a else None
    if ref and ref in pos: pos.remove(ref)
    reviewed = "--preview-reviewed" in a
    if st == "analyse":
        rc = run("palette.py", pos[0], pos[1]); run("af_adapter.py", pos[0], pos[1]); sys.exit(rc)
    model, out = pos[0], pos[1]
    refargs = ["--ref", ref] if ref else []
    if st == "check": sys.exit(run("verify.py", model, out))
    if st == "preview": sys.exit(run("render_preview.py", model, out, *refargs))
    ex = ["--preview-reviewed"] if reviewed else []
    if st == "export": sys.exit(run("export_bambu_3mf.py", model, out, *ex))
    if st == "docs":
        rc = run("make_docs.py", model, out, *refargs)
        if rc: sys.exit(rc)
        d = Path(out) / "deliverables"; d.mkdir(exist_ok=True)
        for f in ("model.3mf", "model.stl", "preview.png", "assembly_instructions.pdf", "print_report.txt"):
            shutil.copy(Path(out) / f, d / f)
        print("DELIVERABLES:", sorted(p.name for p in d.iterdir())); return
    if st == "all":
        for s in (("verify.py", model, out), ("render_preview.py", model, out, *refargs),
                  ("export_bambu_3mf.py", model, out, *ex), ("make_docs.py", model, out, *refargs)):
            if run(*s): sys.exit(f"stopped: {s[0]} failed")
        d = Path(out) / "deliverables"; d.mkdir(exist_ok=True)
        for f in ("model.3mf", "model.stl", "preview.png", "assembly_instructions.pdf", "print_report.txt"):
            shutil.copy(Path(out) / f, d / f)
        print("DELIVERABLES:", sorted(p.name for p in d.iterdir())); return
    sys.exit("unknown stage")

if __name__ == "__main__":
    main()
