"""Independent standard-library-only proof checker: no generator/research imports."""
import collections,datetime as dt,hashlib,itertools,json,platform,resource,sys,time
from pathlib import Path
START=time.monotonic()
ROOT=Path(__file__).resolve().parents[1]

def require(ok,message):
    if not ok:raise AssertionError(message)

def dot(a,b):return sum(x*y for x,y in zip(a,b))
def cross(a,b):return(a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])
def sign(p,n):
    long=tuple(p[i]//2 if abs(p[i])==2 and n[i]==0 else 0 for i in range(3))
    short=tuple(p[i]-2*n[i]-2*long[i] for i in range(3))
    return dot(n,cross(long,short))
def turn(v,axis):
    x,y,z=v
    return((x,-z,y),(z,y,-x),(-y,x,z))[axis]

def verify(path):
    raw=Path(path).read_bytes();candidate=json.loads(raw)
    weekdays='MON TUE WED THU FRI SAT SUN'.split();months='JAN FEB MAR APR MAY JUN JUL AUG SEP OCT NOV DEC'.split()
    palette=dict(weekdayLetters='weekday-black',monthLetters='date-red',dateDigits='date-red',yearDigits='year-gray',timeDigits='time-blue',colon='date-red',wordmark='immutable multicolor images',blank='none')
    expected=dict(language='EN',years=[1900,2099],calendar='proleptic Gregorian',weekdays=weekdays,months=months,dayPadding='zero',hourPadding='zero',minutePadding='zero',yearLayout='thousands,hundreds,blank,tens,units',row4=[' ','wordmark:left','wordmark:middle','wordmark:right',' '],palette=palette,opticalRelaxation='all rotations allowed for every glyph; no character substitutions',legalMoves='12 noncentral single-layer quarter turns on a labeled 5x5; inverses and compositions')
    require(candidate['model']==expected,'Exact scope differs from issue #4')
    # Independently establish the mechanical premises: 24 two-sticker wing
    # cubies, one sticker of each invariant chirality; actual legal generators.
    units=[tuple(s if i==j else 0 for i in range(3)) for j in range(3) for s in [-1,1]]
    lattice=[(p,n) for p in itertools.product(range(-2,3),repeat=3) for n in units if dot(p,n)==2]
    wings=[(p,n) for p,n in lattice if sorted(map(abs,p))==[1,2,2]]
    require(len(lattice)==150 and len(wings)==48,'Physical lattice inventory')
    pieces=collections.defaultdict(list)
    for p,n in wings:pieces[p].append(sign(p,n))
    require(len(pieces)==24 and all(sorted(v)==[-1,1] for v in pieces.values()),'Wing coupling')
    for axis in range(3):
        for layer in [-2,-1,1,2]:
            moved=[(turn(p,axis),turn(n,axis)) if p[axis]==layer else (p,n) for p,n in lattice]
            require(set(moved)==set(lattice),'Legal quarter turn must preserve labeled facelets')
            for (p,n),(q,m) in zip(lattice,moved):
                if (p,n) in wings:require(sign(p,n)==sign(q,m),'Wing chirality must be invariant')
    slots={'A':(1,9,15,23),'B':(3,5,19,21)}
    for side,positions in slots.items():
        require(all(sign((s%5-2,2-s//5,2),(0,0,1))==(1 if side=='A' else -1) for s in positions),'Front orbit classification')
    dates=set();day=dt.date(1900,1,1);date_count=0
    while day<dt.date(2100,1,1):
        year=str(day.year);text=weekdays[day.weekday()]+'  '+f'{day.day:02}'+months[day.month-1]+year[:2]+' '+year[2:]+'     '
        require(len(text)==20 and text[12]==' ','Split-year layout')
        dates.add(tuple(text[i] for i in (1,9,15,3,5,19)));date_count+=1;day+=dt.timedelta(days=1)
    times=set()
    for minute in range(1440):
        text=f'{minute//60:02}:{minute%60:02}';times.add((text[3],text[1]))
    maxima={s:collections.Counter() for s in slots};states=[]
    def token(slot,c):return(-1 if c==' ' else slot,c)
    def ink(slot,c):return 'none' if c==' ' else ('weekday-black' if slot//5==0 else 'date-red' if slot//5==1 else 'time-blue')
    for d,t in itertools.product(sorted(dates),sorted(times)):
        chars=d[:3]+(t[0],)+d[3:]+(t[1],)
        state={s:collections.Counter(token(slot,c) for slot,c in zip(positions,chars[:4] if s=='A' else chars[4:])) for s,positions in slots.items()}
        for s in slots:maxima[s]|=state[s]
        states.append(state)
    # Identity+ink alone separates nonblank role types. All glyph rotations
    # are admitted; this is independent of the chosen font's symmetries.
    for side in slots:
        identities=collections.defaultdict(set)
        for slot,c in maxima[side]:identities[(c,ink(slot,c))].add((slot,c))
        require(all(len(v)==1 for v in identities.values()),'One wing image could serve multiple required role types')
    coexist=set()
    for state in states:
        coexist.update((a,b) for a,n in state['A'].items() for b,m in state['B'].items() if n==maxima['A'][a] and m==maxima['B'][b])
    missing={(a,b) for a in maxima['A'] for b in maxima['B']}-coexist
    require(missing=={((9,'B'),(5,'3'))},'Only the actual-calendar FEB/day-30 exception is allowed')
    for side in slots:
        saved={tuple(v['token']):v['demand'] for v in candidate['inventory'][side]}
        require(saved==maxima[side] and len(saved)==len(candidate['inventory'][side]),'Required multiplicities differ')
    require({(tuple(a),tuple(b)) for a,b in candidate['peakNeverCooccurs']}==missing,'Exception certificate differs')
    a,b=maxima['A'],maxima['B'];sa,sb=24-a.total(),24-b.total()
    top=lambda x,n:sum(sorted(x.values(),reverse=True)[:n])
    count=dict(requiredA=a.total(),requiredB=b.total(),slackA=sa,slackB=sb,maximumLooseA=sa+top(a,sa),minimumTightB=b.total()-top(b,sb),maximumExceptionalPairs=sum(min(a[x],b[y]) for x,y in missing))
    require(candidate['counting']==count,'Counting certificate differs')
    require(count['minimumTightB']>count['maximumLooseA']+count['maximumExceptionalPairs'],'No contradiction; verdict must remain UNKNOWN')
    require(candidate['validDates']==date_count==73049 and candidate['totalDisplays']==date_count*1440,'Date/time domain coverage')
    require(candidate['dateWingProjections']==len(dates) and candidate['timeWingProjections']==len(times) and candidate['combinedWingProjections']==len(states),'Projection coverage differs')
    return dict(status='UNSAT',issue=4,model=expected,candidateSHA256=hashlib.sha256(raw).hexdigest(),checkerSHA256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),validDates=date_count,totalDisplays=date_count*1440,checkedLegalQuarterTurns=12,checkedLabeledFacelets=150,physicalWingCubies=24,allGlyphRotationsAllowed=True,counting=count,contradiction=f"{count['minimumTightB']} > {count['maximumLooseA']} + {count['maximumExceptionalPairs']}",scope='No immutable English printing exists for this exact colored split-year/wordmark target model; not a universal English calendar-cube impossibility claim.',environment=dict(python=platform.python_version(),platform=platform.platform(),solver='none; exhaustive projection enumeration and integer counting'),run=dict(elapsedSeconds=round(time.monotonic()-START,3),maxResidentKiB=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss))
if __name__=='__main__':
    print(json.dumps(verify(sys.argv[1]),ensure_ascii=False,indent=2))
