"""Independent standard-library replay of freshly invoked cubing solver results.

Imports neither ReScript/JS mechanics nor cubing. The full 24 physical sticker
poses and print-up frames must match the frozen complete goal and invert back.
"""
import hashlib,importlib.util,json,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('physical_checker',ROOT/'research/counter/verify.py');physical=importlib.util.module_from_spec(spec);spec.loader.exec_module(physical)
def verify(path):
    raw=Path(path).read_bytes();physical.require(len(raw)<=65536,'Oversized live solver evidence');e=json.loads(raw)
    physical.require(e.get('schema')=='cubistry.live-solver-evidence' and physical.integral(e.get('version')) and e['version']==1 and e.get('puzzle')=='2x2x2','Unsupported live solver evidence')
    physical.require(e.get('startWord')=="R U F2 L' D B",'Unknown reproducible start')
    design=(ROOT/'public/counter-design.v2.json').read_bytes();physical.require(e.get('designSHA256')==hashlib.sha256(design).hexdigest(),'Design provenance mismatch')
    frozen=json.loads((ROOT/'public/counter-proof.json').read_bytes());physical.check(ROOT/'public/counter-proof.json')
    source=tuple((s['id'],s['cubie'],tuple(s['p']),tuple(s['n']),tuple(s['up']),s['image']) for s in frozen['printing']);start=physical.apply(source,e['startWord'])
    cases=e.get('cases');physical.require(isinstance(cases,list) and [c.get('value') for c in cases]==[0,7,42,58,99],'Exact representative goals required')
    for c in cases:
        physical.require(physical.integral(c.get('value')) and c.get('schema')=='cubistry.live-solver-result' and physical.integral(c.get('version')) and c['version']==1 and c.get('solverInvocations')==2,'Invalid solver result metadata')
        physical.require(c.get('backend',{}).get('id')=='cubing/experimentalSolve2x2x2' and c['backend'].get('version')=='0.66.1' and c['backend'].get('frame')=='exact' and c['backend'].get('optimality')=='unknown','Unsupported backend claims')
        word=c.get('word');physical.require(isinstance(word,str) and len(word.split())<=128,'Invalid/excessive solver word')
        state=physical.apply(start,word);physical.show(state,c['value'],True)
        physical.require(state==physical.apply(source,frozen['witnesses'][c['value']]['word']),'Complete physical goal mismatch')
        physical.require(physical.apply(state,physical.inverse(word))==start,'Inverse lost physical sticker identities or frames')
    return dict(status='PASS',values=[c['value'] for c in cases],startWord=e['startWord'],fullPhysicalTargets=5,exactInverseRestorations=5,stickerIdentities=24,independentOfJavaScriptAndSolver=True,sourceSHA256=hashlib.sha256(raw).hexdigest(),checkerSHA256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest())
if __name__=='__main__':print(json.dumps(verify(sys.argv[1] if len(sys.argv)>1 else ROOT/'research/m1-acceptance/live-solver-output.json'),indent=2))
