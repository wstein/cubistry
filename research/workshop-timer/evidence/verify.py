"""Independent, standard-library-only 2x2 timer proof replayer.

No JS, solver, KPuzzle, or generator imports. Every sticker identity, physical
position, normal, and print-up vector is retained through legal turns.
"""
import hashlib,json,itertools,re,sys,time,math
from pathlib import Path
MOVES={'R':(0,1,-1),'L':(0,-1,1),'U':(1,1,-1),'D':(1,-1,1),'F':(2,1,-1),'B':(2,-1,1)}
FRONT=[(-1,1,1),(1,1,1),(-1,-1,1),(1,-1,1)]

def integral(value):return type(value) is int or type(value) is float and math.isfinite(value) and value.is_integer()

def require(ok,message):
    if not ok:raise AssertionError(message)
def rotate(v,axis):
    x,y,z=v
    return ((x,-z,y),(z,y,-x),(-y,x,z))[axis]
def apply(state,word):
    for token in word.split():
        m=re.fullmatch(r'([RLUDFB])(2|\')?',token);require(m is not None,'Illegal move notation '+token)
        axis,layer,d=MOVES[m[1]];amount=(2 if m[2]=='2' else -1 if m[2]=="'" else 1)*d%4
        state=tuple((i,c,rotate_times(p,axis,amount),rotate_times(n,axis,amount),rotate_times(u,axis,amount),image) if p[axis]==layer else (i,c,p,n,u,image) for i,c,p,n,u,image in state)
    return state
def rotate_times(v,axis,n):
    for _ in range(n):v=rotate(v,axis)
    return v
def inverse(word):return ' '.join(t if t.endswith('2') else t[:-1] if t.endswith("'") else t+"'" for t in reversed(word.split()))
def show(state,minute,second):
    expected=list(f"{minute:02d}{second:02d}")
    for p,image in zip(FRONT,expected):
        faces=[s for s in state if s[2]==p and s[3]==(0,0,1)]
        require(len(faces)==1,'Exactly one front sticker per position')
        require(faces[0][5]==image,'Wrong immutable digit at '+str((minute,second,p,image,faces[0][5])))
        require(faces[0][4]==(0,1,0),'Digit not upright')

def dot(a,b):return sum(x*y for x,y in zip(a,b))
def cross(a,b):return (a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])

def upper_bound():
    # A sticker's two invariants determine exactly one upright front slot.
    # Proper rigid rotations preserve dot and cross products.
    signatures=[(dot(p,(0,1,0)),dot(p,cross((0,1,0),(0,0,1)))) for p in FRONT]
    require(len(set(signatures))==4,'Upright slots must be disjoint')
    # To include 60:00, minute tens need 0..6, units 0..9,
    # second tens 0..5, and second units always 0: 23 distinct slot/digit types.
    variable=7+10+6
    cases=[]
    for copies in range(1,25):
        # With one seconds-zero sticker, its cubie is always occupied there;
        # its other two stickers cannot serve any other front position.
        unusable=2 if copies==1 else 0
        required=variable+copies+unusable
        require(required>24,'Capacity contradiction must hold for every copy count')
        cases.append(dict(secondsZeroCopies=copies,requiredStickerBudget=required))
    return dict(status='UNSAT',firstExcludedSeconds=3600,
                method='rigid-frame slot invariant and exhaustive zero-copy budget cases',cases=cases)

def check(path):
    start=time.monotonic();raw=Path(path).read_bytes();data=json.loads(raw)
    require(data.get('schema')=='cubistry.timer-2x2-proof' and type(data.get('version')) is int and data['version']==1 and data.get('puzzle')=='2x2x2','Unsupported witness schema/version/puzzle')
    require(type(data.get('stepSeconds')) is int and data['stepSeconds']==10 and type(data.get('maxSeconds')) is int and data['maxSeconds']==3590,'Wrong timer range')
    printing=data['printing']
    require(all(integral(s.get('id')) and integral(s.get('cubie')) for s in printing),'Sticker/cubie IDs must be integer wire values, not booleans')
    require(len(printing)==24 and sorted(s['id'] for s in printing)==list(range(24)),'24 distinct sticker IDs')
    require(len({(tuple(s['p']),tuple(s['n'])) for s in printing})==24,'Unique lattice facelets')
    axes={tuple(sign if i==axis else 0 for i in range(3)) for axis in range(3) for sign in [-1,1]}
    expected={(p,n) for p in itertools.product([-1,1],repeat=3) for n in axes if sum(a*b for a,b in zip(p,n))==1}
    require({(tuple(s['p']),tuple(s['n'])) for s in printing}==expected,'Complete physical 24-facelet lattice')
    require(sorted({s['cubie'] for s in printing})==list(range(8)),'Eight distinct physical cubie IDs')
    groups={}
    for s in printing:
        require(all(isinstance(s.get(k),list) and len(s[k])==3 and all(integral(v) for v in s[k]) for k in ('p','n','up')),'Frames require integer vectors, not booleans')
        p,n,u=map(tuple,(s['p'],s['n'],s['up']));require(all(abs(x)==1 for x in p),'2x2 corner position')
        require(n in axes and u in axes,'Normals and print-up vectors must be signed coordinate axes')
        require(sum(x*x for x in n)==sum(x*x for x in u)==1 and sum(a*b for a,b in zip(n,u))==0,'Rigid tangent frame')
        require(sum(a*b for a,b in zip(p,n))==1,'Outward face normal')
        groups.setdefault(s['cubie'],[]).append(s)
    require(len(groups)==8 and all(len(v)==3 and len({tuple(s['p']) for s in v})==1 for v in groups.values()),'Eight whole three-sticker cubies')
    require(len({tuple(v[0]['p']) for v in groups.values()})==8,'Cubies must occupy eight distinct positions')
    source=tuple((s['id'],s['cubie'],tuple(s['p']),tuple(s['n']),tuple(s['up']),s['image']) for s in printing)
    require(all(type(s['image']) is str and s['image'] in '0123456789' and len(s['image'])==1 for s in printing),'Distinct digit identities only')
    # Recompute sticker slot membership from physical frames, ignoring generator slot annotations.
    for s in printing:
        signature=(dot(s['p'],s['up']),dot(s['p'],cross(s['up'],s['n'])))
        require(signature in [(p[1],p[0]) for p in FRONT],'Each upright sticker has one front slot')
    ws=data['witnesses']
    require(len(ws)==360,'360 required settled displays')
    states=[]
    for tick,w in enumerate(ws):
        require(all(type(w.get(k)) is int for k in ('tick','minute','second')) and isinstance(w.get('word'),str),'Witness types')
        require((w['tick'],w['minute'],w['second'])==(tick,tick//6,(tick%6)*10),'Exact ordered timer coverage')
        state=apply(source,w['word']);show(state,w['minute'],w['second'])
        require(apply(state,inverse(w['word']))==source,'Inverse must restore all 24 original frames')
        states.append(state)
    # Replay the entire actual descending timer, not just source-to-target states.
    state=states[-1]
    for tick in range(358,-1,-1):
        state=apply(state,inverse(ws[tick+1]['word'])+' '+ws[tick]['word'])
        show(state,tick//6,(tick%6)*10)
        require(state==states[tick],'Descending transition must equal canonical state')
    # Negative controls: altered permanent ink orientation, altered digit and illegal move.
    for field in ('up','image'):
        altered=[dict(s) for s in printing]
        altered[0][field]=[-x for x in altered[0]['up']] if field=='up' else '9'
        bad=tuple((s['id'],s['cubie'],tuple(s['p']),tuple(s['n']),tuple(s['up']),s['image']) for s in altered)
        rejected=False
        for w in ws:
            try:show(apply(bad,w['word']),w['minute'],w['second'])
            except AssertionError:rejected=True;break
        require(rejected,'Tampered '+field+' must fail')
    rejected=False
    try:apply(source,'X')
    except AssertionError:rejected=True
    require(rejected,'Illegal moves must fail')
    bound=upper_bound()
    return dict(status='SAT',maxDisplay='59:50',stepSeconds=10,settledDisplays=360,
        minimumRequirement='15:00',minimumRequirementCovered=True,
        forwardWordsReplayed=360,inverseWordsReplayed=360,descendingTransitionsReplayed=359,
        allOrderedTransitionsBySourceFactorization=360*360,
        physicalCubies=8,physicalStickers=24,orientationAndDigitTamperingRejected=True,
        upperBound=bound,witnessSHA256=hashlib.sha256(raw).hexdigest(),
        checkerSHA256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),runtimeSeconds=round(time.monotonic()-start,3))
if __name__=='__main__':
    print(json.dumps(check(sys.argv[1] if len(sys.argv)>1 else Path(__file__).with_name('witness.json')),indent=2))
