"""Independent rigid-sticker replay of certified data and actual controller commits.

No JS geometry, solver, or certificate distance table is imported.
"""
import hashlib,importlib.util,json,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('physical',ROOT/'research/counter/verify.py')
P=importlib.util.module_from_spec(spec);spec.loader.exec_module(P)
HERE=Path(__file__).resolve().parent

def require(ok,msg):
    if not ok:raise AssertionError(msg)
def read(path):return json.loads(path.read_text())
def hashfile(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def state_from_wire(printing,state):
    cubies={c['id']:c for c in state['cubies']}
    def rotate(v,r):return tuple(sum(v[j]*r[j][i] for j in range(3)) for i in range(3))
    return tuple((s['id'],s['cubie'],tuple(cubies[s['cubie']]['position']),rotate(s['normal'],cubies[s['cubie']]['orientation']),rotate(s['up'],cubies[s['cubie']]['orientation']),s['assetId']) for s in printing['stickers'])
def check(trace_path=ROOT/'test-results/certified-commits.json'):
    evidence=HERE/'evidence';manifest=read(evidence/'manifest.json')
    for name in ['optimized.json','setups.json','verification.json','transitions.csv']:
        require(hashfile(evidence/name)==manifest['sha256'][name],'Frozen evidence hash mismatch: '+name)
    raw=read(ROOT/'public/counter-certified.v1.json');candidate=read(evidence/'optimized.json')['runs'][0];setup=read(evidence/'setups.json')['runs'][0]
    require(raw['printing']==candidate['printing'],'Runtime print differs from frozen source')
    require(raw['increments']==candidate['optimized']['words'][1:],'Runtime transitions differ from source')
    require(raw['zeroWord']==setup['zeroWord']==candidate['optimized']['words'][0],'Canonical setup mismatch')
    for name,digest in raw['provenance'].items():require(hashfile(evidence/name)==digest,'Source provenance mismatch')
    source=tuple((s['id'],s['cubie'],tuple(s['p']),tuple(s['n']),tuple(s['up']),s['image']) for s in raw['printing'])
    state=P.apply(source,raw['zeroWord']);P.show(state,0,True);states=[state];total=0
    for value,word in enumerate(raw['increments'],1):
        total+=len(word.split());require(1<=len(word.split())<=5,'Invalid edge HTM')
        state=P.apply(state,word);P.show(state,value,True);states.append(state)
    require(total==339 and len(states)==100 and len(raw['zeroWord'].split())==5,'Exact canonical counts')
    for value in range(99,0,-1):
        state=P.apply(state,P.inverse(raw['increments'][value-1]));require(state==states[value-1],'Exact reverse restoration')
    require(P.apply(state,P.inverse(raw['zeroWord']))==source,'Setup inverse')
    trace=read(Path(trace_path));require(len(trace['transitions'])==99,'Actual 99 transitions')
    state=state_from_wire(trace['print'],trace['start']);require(state==states[0],'Actual zero full state')
    committed=0
    for value,item in enumerate(trace['transitions'],1):
        require(item['value']==value,'Actual value order');committed+=len(item['word'].split())
        state=P.apply(state,item['word']);P.show(state,value,True)
        require(state==states[value]==state_from_wire(trace['print'],item['state']),'Actual complete sticker identities/frames')
    require(committed==339,'Actual committed trace HTM')
    return {'status':'SAT','values':100,'actualCommittedHTM':committed,'adjacentTransitions':99,'maximumHTM':5,'reverseHTM':339,'setupHTMExcluded':5,'globalOptimality':'UNKNOWN'}
if __name__=='__main__':print(json.dumps(check(Path(sys.argv[1]) if len(sys.argv)>1 else ROOT/'test-results/certified-commits.json'),indent=2))
