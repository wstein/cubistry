#!/usr/bin/env python3
"""Lossless process capture only; no certificate verification or solver logic."""
import argparse, hashlib, json, subprocess, time
from pathlib import Path

def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--output',type=Path,required=True); ap.add_argument('command',nargs=argparse.REMAINDER); a=ap.parse_args()
    command=a.command[1:] if a.command[:1]==['--'] else a.command
    a.output.mkdir(parents=True,exist_ok=False)
    start=time.perf_counter_ns()
    with (a.output/'stdout.txt').open('wb') as out, (a.output/'stderr.txt').open('wb') as err:
        result=subprocess.run(['/usr/bin/time','-v','-o',str(a.output/'resources.txt'),'--',*command],stdout=out,stderr=err)
    elapsed=time.perf_counter_ns()-start
    root=Path.cwd(); paths=[root/'proof-checkers/flix-recovery/artifact/flix.jar',*sorted((root/'proof-checkers/flix-recovery/src').glob('*.flix'))]
    paths += [root/'proof-checkers/conformance-hsm/cases'/n for n in ('recovery-unsupported.json','modes.json')]
    record={'command':command,'cwd':str(root),'exitCode':result.returncode,'elapsedNanoseconds':elapsed,'sha256':{str(p.relative_to(root)):sha(p) for p in paths},'stdoutSHA256':sha(a.output/'stdout.txt'),'stderrSHA256':sha(a.output/'stderr.txt')}
    (a.output/'run.json').write_text(json.dumps(record,indent=2)+'\n')
    print(json.dumps(record))
if __name__=='__main__': main()
