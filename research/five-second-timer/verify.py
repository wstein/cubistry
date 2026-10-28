"""Independent physical replay, shortest-display audit and maximum-range proof.

Uses the existing standard-library physical engine and independently built frame
BFS, never the JavaScript generator, provider solver, or provider lookup table.
"""
import hashlib, importlib.util, itertools, json, sys, time
from pathlib import Path
HERE=Path(__file__).resolve().parent

def load(name,path):
    spec=importlib.util.spec_from_file_location(name,path);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module
P=load('timer_physical',HERE.parent/'timer-2x2/verify.py')
B=load('timer_distances',HERE.parent/'timer-2x2/optimization/verify.py')
U=load('five_second_upper',HERE/'upper_bound.py')

def check(path, shortest=True):
    began=time.monotonic();raw=Path(path).read_bytes();d=json.loads(raw)
    P.require(d.get('schema')=='cubistry.five-second-timer' and type(d.get('version')) is int and d['version']==1,'Schema')
    P.require(type(d.get('stepSeconds')) is int and d['stepSeconds']==5 and type(d.get('maxSeconds')) is int and d['maxSeconds']==2395,'Exact5-second maximum')
    printing=d['printing'];axes={tuple(sign if i==axis else 0 for i in range(3)) for axis in range(3) for sign in (-1,1)}
    expected={(p,n) for p in itertools.product((-1,1),repeat=3) for n in axes if P.dot(p,n)==1}
    P.require(len(printing)==24 and all(type(s.get('id')) is int and type(s.get('cubie')) is int for s in printing),'24 integer sticker/cubie IDs')
    P.require(sorted(s['id'] for s in printing)==list(range(24)),'Unique sticker IDs')
    P.require({(tuple(s['p']),tuple(s['n'])) for s in printing}==expected,'Complete physical facelet lattice')
    groups={}
    for s in printing:
        P.require(all(isinstance(s.get(k),list) and len(s[k])==3 and all(type(v) is int for v in s[k]) for k in ('p','n','up')),'Integer signed frames')
        p,n,u=map(tuple,(s['p'],s['n'],s['up']))
        P.require(n in axes and u in axes and P.dot(n,u)==0 and P.dot(p,n)==1,'Outward normal and tangent upright frame')
        P.require(type(s['image']) is str and len(s['image'])==1 and s['image'] in '0123456789','Distinct digit images;no aliases')
        P.require((P.dot(p,u),P.dot(p,P.cross(u,n))) in [(p[1],p[0]) for p in P.FRONT],'Exact useful upright slot')
        groups.setdefault(s['cubie'],[]).append(s)
    P.require(sorted(groups)==list(range(8)) and all(len(g)==3 and len({tuple(s['p']) for s in g})==1 for g in groups.values()),'Eight rigid three-face corners')
    P.require(len({tuple(g[0]['p']) for g in groups.values()})==8,'Distinct corner positions')
    source=tuple((s['id'],s['cubie'],tuple(s['p']),tuple(s['n']),tuple(s['up']),s['image']) for s in printing)
    P.require(type(d.get('zeroWord')) is str and isinstance(d.get('increments'),list) and len(d['increments'])==479,'480 inclusive states /479 edges')
    states=[];state=source;words=[d['zeroWord']]+d['increments'];lengths=[]
    if shortest:dist,lookup,encode=B.build_distances()
    for tick,word in enumerate(words):
        P.require(type(word) is str and len(word.split())<=32,'Bounded legal word')
        if shortest:
            digits=f'{tick*5//60:02d}{tick*5%60:02d}';candidates=[]
            for slot,digit in enumerate(digits):
                front=P.FRONT[slot]
                candidates.append([s for s in state if s[5]==digit and (P.dot(s[2],s[4]),P.dot(s[2],P.cross(s[4],s[3])))==(front[1],front[0])])
            best=255
            for selected in itertools.product(*candidates):
                if len({s[1] for s in selected})==4:best=min(best,dist[encode([lookup[(s[3],s[4])] for s in selected])])
            P.require(best!=255 and len(word.split())==best,'Consecutive word is not shortest for this reached source/display')
        nxt=P.apply(state,word);P.show(nxt,tick*5//60,tick*5%60)
        P.require(P.apply(nxt,P.inverse(word))==state,'Every inverse restores full physical frames')
        states.append(nxt);state=nxt
        if tick:lengths.append(len(word.split()))
    P.require(type(d.get('totalHTM')) is int and d['totalHTM']==sum(lengths) and type(d.get('maximumHTM')) is int and d['maximumHTM']==max(lengths),'Honest HTM accounting')
    for tick in range(478,-1,-1):
        state=P.apply(state,P.inverse(d['increments'][tick]));P.require(state==states[tick],'Actual reverse route mismatch')
        P.show(state,tick*5//60,tick*5%60)
    upper=U.audit_upper_bound();P.require(upper['status']=='UNSAT' and upper['firstExcludedSeconds']==2400,'Exact boundary proof')
    return dict(status='SAT',maximumRangeProven=True,maxSeconds=2395,maximumDisplay='39:55',inclusiveStates=480,adjacentEdges=479,
        totalHTM=sum(lengths),meanHTM=sum(lengths)/479,maximumHTM=max(lengths),reverseHTM=sum(lengths),setupHTM=len(d['zeroWord'].split()),
        thirtyMinuteStates=361,thirtyMinuteEdges=360,thirtyMinuteHTM=sum(lengths[:360]),firstExcludedSeconds=2400,upperBound='UNSAT',
        shortestDisplayEdgesVerified=479 if shortest else None,globalPrintMoveOptimality='UNKNOWN',certificateSHA256=hashlib.sha256(raw).hexdigest(),runtimeSeconds=round(time.monotonic()-began,3))
if __name__=='__main__': print(json.dumps(check(sys.argv[1] if len(sys.argv)>1 else HERE/'certificate.json'),indent=2))
