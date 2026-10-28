"""Independent review-only five-second timer replay; no project imports.
Quarter turns use integer Rodrigues rotations about the signed face axis.
"""
import hashlib, itertools, json, re, sys
from pathlib import Path
FACES={'R':(0,1),'L':(0,-1),'U':(1,1),'D':(1,-1),'F':(2,1),'B':(2,-1)}
POSITIONS=tuple(itertools.product((-1,1),repeat=3))
FRONT=((-1,1,1),(1,1,1),(-1,-1,1),(1,-1,1))
AXES=tuple(tuple(s if i==axis else 0 for i in range(3)) for axis in range(3) for s in (-1,1))
def need(ok,msg):
    if not ok:raise AssertionError(msg)
def dot(a,b):return sum(a[i]*b[i] for i in range(3))
def cross(a,b):return(a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])
def rotate(v,axis,k):
    e=tuple(1 if i==axis else 0 for i in range(3));c=(1,0,-1,0)[k%4];s=(0,1,0,-1)[k%4]
    perpendicular=cross(e,v);parallel=dot(e,v)
    return tuple(v[i]*c+perpendicular[i]*s+e[i]*parallel*(1-c) for i in range(3))
def apply(state,word):
    for token in word.split():
        m=re.fullmatch(r"([RLUDFB])(2|')?",token);need(m is not None,'Legal outer-face token')
        axis,side=FACES[m[1]];amount=2 if m[2]=='2' else -1 if m[2]=="'" else 1;k=-side*amount
        state=tuple((id,cube,rotate(p,axis,k),rotate(n,axis,k),rotate(up,axis,k),ink) if p[axis]==side else (id,cube,p,n,up,ink) for id,cube,p,n,up,ink in state)
    return state
def inverse(word):return ' '.join(t if t.endswith('2') else t[:-1] if t.endswith("'") else t+"'" for t in word.split()[::-1])
def show(state,seconds):
    digits=f'{seconds//60:02d}{seconds%60:02d}'
    for p,digit in zip(FRONT,digits):
        candidates=[s for s in state if s[2]==p and s[3]==(0,0,1)]
        need(len(candidates)==1,'Exactly one front physical sticker')
        need(candidates[0][5]==digit,'Exact fixed digit at '+str(seconds))
        need(candidates[0][4]==(0,1,0),'Upright glyph at '+str(seconds))
def validate(path):
    raw=Path(path).read_bytes();d=json.loads(raw)
    need(d['schema']=='cubistry.five-second-timer' and type(d['version']) is int and d['version']==1,'Versioned input')
    need(type(d['stepSeconds']) is int and d['stepSeconds']==5,'Exact5sec step')
    need(type(d['maxSeconds']) is int and d['maxSeconds']==2395,'Exact39:55 cap')
    printing=d['printing'];need(len(printing)==24,'24stickers')
    need(all(type(s['id']) is int and type(s['cubie']) is int for s in printing),'Integer identities')
    need(sorted(s['id'] for s in printing)==list(range(24)),'Unique24sticker IDs')
    expected={(p,n) for p in POSITIONS for n in AXES if dot(p,n)==1}
    observed=set();bodies={}
    for s in printing:
        for key in ('p','n','up'):
            need(type(s[key]) is list and len(s[key])==3 and all(type(v) is int for v in s[key]),'Integral3D vectors')
        p,n,up=(tuple(s[k]) for k in ('p','n','up'))
        need(p in POSITIONS and n in AXES and up in AXES and dot(p,n)==1 and dot(n,up)==0,'Physical outward/tangent frame')
        need(type(s['image']) is str and len(s['image'])==1 and s['image'] in '0123456789','One immutable decimal glyph')
        observed.add((p,n));bodies.setdefault(s['cubie'],[]).append(p)
    need(observed==expected,'Complete physical lattice, no duplicate facelet')
    need(sorted(bodies)==list(range(8)) and all(len(v)==3 and len(set(v))==1 for v in bodies.values()),'Eight rigid3sticker bodies')
    need(len({v[0] for v in bodies.values()})==8,'Eight distinct corner positions')
    source=tuple((s['id'],s['cubie'],tuple(s['p']),tuple(s['n']),tuple(s['up']),s['image']) for s in printing)
    words=[d['zeroWord']]+d['increments'];need(len(words)==480,'480inclusive states')
    state=source;states=[];lengths=[]
    for tick,word in enumerate(words):
        need(type(word) is str and len(word.split())<=32,'Bounded move word')
        old=state;state=apply(state,word);show(state,tick*5)
        need(apply(state,inverse(word))==old,'Every edge inverse retains full24identity frames')
        states.append(state)
        if tick:lengths.append(len(word.split()))
    for tick in range(478,-1,-1):
        state=apply(state,inverse(words[tick+1]));need(state==states[tick],'Complete reverse traversal exactness');show(state,tick*5)
    need(apply(state,inverse(words[0]))==source,'Zero setup inverse restores source')
    need(type(d['totalHTM']) is int and sum(lengths)==d['totalHTM'],'Honest total HTM')
    need(type(d['maximumHTM']) is int and max(lengths)==d['maximumHTM'],'Honest maximum HTM')
    return {'status':'SAT','physicalStates':480,'adjacentEdges':479,'totalHTM':sum(lengths),'maximumHTM':max(lengths),'meanHTM':sum(lengths)/479,'setupHTM':len(words[0].split()),'thirtyMinuteStates':361,'thirtyMinuteEdges':360,'thirtyMinuteHTM':sum(lengths[:360]),'fullReverseEdgesVerified':479,'candidateSHA256':hashlib.sha256(raw).hexdigest()}
if __name__=='__main__':print(json.dumps(validate(sys.argv[1]),indent=2))
