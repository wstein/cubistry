#!/usr/bin/env python3
"""Separate recovery build; copies the unchanged native Flix dependencies."""
import argparse, hashlib, json, os, shutil, subprocess, time
from pathlib import Path
HERE = Path(__file__).resolve().parent
OLD = HERE.parent / "flix"
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
    ap=argparse.ArgumentParser(); ap.add_argument("--output",type=Path,required=True); a=ap.parse_args()
    if a.output.exists(): ap.error("output must be new")
    project=HERE/"work"; project.mkdir(exist_ok=True); (project/"src").mkdir(exist_ok=True)
    for p in (project/"src").glob("*.flix"): p.unlink()
    sources=list((OLD/"src").glob("*.flix"))
    sources=[p for p in sources if p.name != "Main.flix"] + list((HERE/"src").glob("*.flix"))
    for p in sources: shutil.copy2(p,project/"src"/p.name)
    for n in ("flix.toml","packages.lock","flixw"): shutil.copy2(OLD/n,project/n)
    shutil.copytree(OLD/".flixw",project/".flixw",dirs_exist_ok=True)
    (project/"flixw").chmod(0o755)
    cmd=["./flixw","build-fatjar","--threads","2"]
    start=time.perf_counter(); subprocess.run(cmd,cwd=project,check=True); elapsed=time.perf_counter()-start
    pin=json.loads((OLD/"parser-pin.json").read_text()); jars=list((project/"lib").glob("**/jackson-core-2.22.4.jar"))
    if not jars or any(sha(p)!=pin["sha256"] for p in jars): raise RuntimeError("parser pin mismatch")
    (HERE/"artifact").mkdir(exist_ok=True); artifact=HERE/"artifact"/"flix.jar"; shutil.copy2(project/"artifact"/"work.jar",artifact)
    out={"command":cmd,"elapsedSeconds":elapsed,"artifactSHA256":sha(artifact),"artifactBytes":artifact.stat().st_size,"parserSHA256":pin["sha256"],"sourceSHA256":{str(p.relative_to(HERE.parent.parent)):sha(p) for p in sorted(sources)}}
    a.output.write_text(json.dumps(out,indent=2)+"\n"); print(json.dumps(out,indent=2))
if __name__=="__main__": main()
