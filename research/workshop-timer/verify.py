"""Independent immutable timer evidence and actual-commit replay; no JS imports."""
import hashlib,importlib.util,json,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('timer_physics',HERE/'evidence/verify.py');P=importlib.util.module_from_spec(spec);spec.loader.exec_module(P)
def read(p):return json.loads(p.read_text())
def wire(printing,state):
    by={c['id']:c for c in state['cubies']}
    def rotate(v,r):return tuple(sum(v[j]*r[j][i] for j in range(3)) for i in range(3))
    return tuple((s['id'],s['cubie'],tuple(by[s['cubie']]['position']),rotate(s['normal'],by[s['cubie']]['orientation']),rotate(s['up'],by[s['cubie']]['orientation']),s['assetId']) for s in printing['stickers'])
def check(trace=None):
    evidence=HERE/'evidence';provenance=read(HERE/'provenance.json')
    for name,digest in provenance['sha256'].items():P.require(hashlib.sha256((evidence/name).read_bytes()).hexdigest()==digest,'Immutable evidence mismatch '+name)
    raw=read(ROOT/'public/workshop-timer.v1.json');source=read(evidence/'optimization/optimized.json')['runs'][1]
    P.require(raw['printing']==source['printing'] and raw['increments']==source['optimized']['words'][1:] and raw['zeroWord']==source['optimized']['words'][0],'Runtime certificate differs from source')
    state=tuple((s['id'],s['cubie'],tuple(s['p']),tuple(s['n']),tuple(s['up']),s['image'])for s in raw['printing'])
    state=P.apply(state,raw['zeroWord']);states=[state];P.show(state,0,0)
    for i,word in enumerate(raw['increments'],1):
        state=P.apply(state,word);P.show(state,i//6,(i%6)*10);states.append(state)
    P.require(sum(len(w.split())for w in raw['increments'])==1324 and max(len(w.split())for w in raw['increments'])==5,'Invalid complete route')
    for i in range(359,0,-1):state=P.apply(state,P.inverse(raw['increments'][i-1]));P.require(state==states[i-1],'Inverse does not restore complete physical pose')
    result={'status':'PASS','displays':360,'adjacentHTM':1324,'maximumHTM':5,'sourceToZeroSetupHTM':5,'initialConfigurationExcluded':True}
    if trace:
        data=read(Path(trace));printing=data['print'];state=wire(printing,data['start']);start=data.get('startValue',90)
        P.require(state==states[start],'Actual trace starts in wrong full state');total=0
        for transition in data['transitions']:
            word=transition['word'];total+=len(word.split());state=P.apply(state,word);value=transition['value'];P.show(state,value//6,(value%6)*10)
            P.require(state==wire(printing,transition['state'])==states[value],'Actual committed pose mismatch')
        result.update(actualTransitions=len(data['transitions']),actualHTM=total,finalValue=data['transitions'][-1]['value']if data['transitions']else start)
        if data.get('kind')=='countdown':
            P.require(start==90 and len(data['transitions'])==90,'Countdown needs 90 edges and initial 15:00')
            P.require([t['value'] for t in data['transitions']]==list(range(89,-1,-1)),'Countdown must visit all 91 states in order')
            P.require(total==331 and result['finalValue']==0,'Incorrect actual fifteen-minute traversal')
    return result
if __name__=='__main__':print(json.dumps(check(sys.argv[1]if len(sys.argv)>1 else None),indent=2))
