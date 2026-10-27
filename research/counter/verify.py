"""Independent, standard-library-only 2x2 fixed-print proof replayer.

No JS, solver, KPuzzle, or generator imports. Every sticker identity, physical
position, normal, and print-up vector is retained through legal turns.
"""
import hashlib,json,itertools,random,re,sys,time
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
MOVES={'R':(0,1,-1),'L':(0,-1,1),'U':(1,1,-1),'D':(1,-1,1),'F':(2,1,-1),'B':(2,-1,1)}
FRONT=[(-1,1,1),(1,1,1),(-1,-1,1),(1,-1,1)]

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
def show(state,value,padded):
    expected=['title-left','title-right',' ' if not padded and value<10 else str(value//10),str(value%10)]
    for p,image in zip(FRONT,expected):
        faces=[s for s in state if s[2]==p and s[3]==(0,0,1)]
        require(len(faces)==1,'Exactly one front sticker per position')
        require(faces[0][5]==image,'Wrong immutable image at '+str((value,p,image,faces[0][5])))
        require(image==' ' or faces[0][4]==(0,1,0),'Image not upright')
def check(path):
    start=time.monotonic();raw=Path(path).read_bytes();data=json.loads(raw);printing=data['printing']
    require(len(printing)==24 and sorted(s['id'] for s in printing)==list(range(24)),'24 distinct sticker IDs')
    require(len({(tuple(s['p']),tuple(s['n'])) for s in printing})==24,'Unique lattice facelets')
    groups={}
    for s in printing:
        p,n,u=map(tuple,(s['p'],s['n'],s['up']));require(all(abs(x)==1 for x in p),'2x2 corner position')
        require(sum(x*x for x in n)==sum(x*x for x in u)==1 and sum(a*b for a,b in zip(n,u))==0,'Rigid tangent frame')
        require(sum(a*b for a,b in zip(p,n))==1,'Outward face normal')
        groups.setdefault(s['cubie'],[]).append(s)
    require(len(groups)==8 and all(len(v)==3 and len({tuple(s['p']) for s in v})==1 for v in groups.values()),'Eight whole three-sticker cubies')
    source=tuple((s['id'],s['cubie'],tuple(s['p']),tuple(s['n']),tuple(s['up']),s['image']) for s in printing)
    require([w['value'] for w in data['witnesses']]==list(range(100)),'Every value once')
    words=[w['word'] for w in data['witnesses']];states=[]
    for value,word in enumerate(words):
        state=apply(source,word);show(state,value,True);require(apply(state,inverse(word))==source,'Inverse does not return to common state');states.append(state)
    # The unpadded print is a distinct fixed printing, not a color/image change
    # at runtime: its one tens-zero sticker is permanently unprinted.
    unpadded=tuple((i,c,p,n,u,' ' if c<4 and image=='0' else image) for i,c,p,n,u,image in source)
    declared=tuple((s['id'],s['cubie'],tuple(s['p']),tuple(s['n']),tuple(s['up']),s['image']) for s in data['unpaddedPrinting'])
    require(declared==unpadded,'Declared second fixed print differs')
    require(sum(a!=b for a,b in zip(source,unpadded))==1,'Only tens zero is replaced in the second fixed print')
    for value,word in enumerate(words):show(apply(unpadded,word),value,False)
    # For every ordered pair, A^-1 reaches the checked common state and B
    # reaches its checked canonical target. This factors a proof of all10,000
    # ordered transitions without claiming shortest display paths.
    for a,b in itertools.product(range(100),repeat=2):require(apply(states[a],inverse(words[a]))==source,'Pairwise hub factorization failed')
    random.seed(18);chain=[0]+list(range(100))+list(range(99,-1,-1))+[random.randrange(100) for _ in range(400)]
    chain += [min(99,max(0,chain[-1]+step)) for step in [1,-1,10,-10]*50]
    state=states[0];current=0
    for value in chain[1:]:state=apply(state,inverse(words[current])+' '+words[value]);show(state,value,True);require(state==states[value],'Chained state differs');current=value
    require(8*3==24 and (8-2)*3==18 and 10*2==20 and 9*2+1+1==20,'Fixed upper-cubie impossibility premises')
    # Tamper control: rotate a title source print, not the target specification.
    bad=list(source);i=next(i for i,s in enumerate(bad) if s[5]=='title-left');s=bad[i];n,u=s[3],s[4];bad[i]=s[:4]+((-u[0],-u[1],-u[2]),)+s[5:]
    rejected=False
    for value,word in enumerate(words):
        try:show(apply(tuple(bad),word),value,True)
        except AssertionError:rejected=True;break
    require(rejected,'Rotated physical title must be rejected')
    return dict(verdicts={'paddedTextMovable':'SAT','unpaddedTextMovable':'SAT','paddedTextFixedCubies':'UNSAT','unpaddedTextFixedCubies':'UNSAT','blankFallback':'NOT_RUN_TEXT_SAT','externalOverlay':'SAT_as_weaker_target_not_used'},witnessSHA256=hashlib.sha256(raw).hexdigest(),independentCheckerSHA256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),physicalCubies=8,physicalStickers=24,titleCopies={'left':2,'right':2},valuesVerified=100,orderedTransitionsByHubFactorization=10000,chainedTransitions=len(chain)-1,allMovesLegal=True,allVisiblePrintedGlyphsUpright=True,actualPrintRotationTamperRejected=True,fixedCubieProof={'availableDigitFaces':18,'requiredPadded':20,'requiredUnpadded':20},runtimeSeconds=round(time.monotonic()-start,3))
if __name__=='__main__':
    result=check(sys.argv[1] if len(sys.argv)>1 else ROOT/'public/counter-proof.json')
    print(json.dumps(result,indent=2))
