#!/usr/bin/env python3
"""Hash/count audit only: this script never decides an HSM proof claim."""
import hashlib, json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
PIN='0c497d15ca1cf530c7b8be2a6775723bc562e2583c5c2cfc103265b3a4935993'
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
    path=ROOT/'proof-checkers/conformance-hsm/manifest.json'
    if sha(path)!=PIN: raise RuntimeError('HSM data manifest hash mismatch')
    manifest=json.loads(path.read_text()); cases=manifest['cases']
    if len(cases)!=46 or manifest['caseCount']!=46: raise RuntimeError('HSM data count mismatch')
    directory=ROOT/'proof-checkers/conformance-hsm/cases'
    if sorted(p.name for p in directory.iterdir())!=sorted(c['name']+'.json' for c in cases): raise RuntimeError('HSM data filename mismatch')
    hashes={}
    for case in cases:
        p=ROOT/case['path']; actual=sha(p)
        if actual!=case['sha256']: raise RuntimeError('HSM data file hash mismatch: '+case['name'])
        hashes[case['path']]=actual
    print(json.dumps({'status':'PASS_DATA_PINS','mathematicalVerification':'NOT_RUN','cases':len(cases),'manifestSHA256':PIN,'inputSHA256':hashes},indent=2))
if __name__=='__main__': main()
