"""Independent positive verifier: rigid glyph poses, finite target cover,
then exact simultaneous reachability in the labeled 5x5 move group.
No source geometry, move tables, or matching code is imported from JS/ReScript.
"""
import copy
import collections
import datetime as dt
import itertools
import math
import time
import sympy
from sympy.combinatorics import Permutation, PermutationGroup


def require(ok,message):
    if not ok:
        raise AssertionError(message)


def dot(a,b):
    return sum(x*y for x,y in zip(a,b))


def cross(a,b):
    return (a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])


UNITS=[(1,0,0),(-1,0,0),(0,1,0),(0,-1,0),(0,0,1),(0,0,-1)]
ROTATIONS=[(x,y,cross(x,y)) for x in UNITS for y in UNITS if dot(x,y)==0]


def rotate(v,R):
    return tuple(sum(v[j]*R[j][i] for j in range(3)) for i in range(3))


def quarter(v,axis):
    u=tuple(int(i==axis) for i in range(3))
    return tuple(x+dot(u,v)*y for x,y in zip(cross(u,v),u))


def piece_class(p):
    return {(2,2,2):'corners',(1,2,2):'wings',(0,2,2):'middleEdges',
            (1,1,2):'diagonalCenters',(0,1,2):'axialCenters',(0,0,2):'fixedCenters'}[tuple(sorted(map(abs,p)))]


def chirality(p,n):
    m=tuple(v//2 if abs(v)==2 and n[i]==0 else 0 for i,v in enumerate(p))
    q=tuple(v-2*n[i]-2*m[i] for i,v in enumerate(p))
    return dot(n,cross(m,q))


_GROUP_CERTIFICATE = None

def palette_ink(palette,slot,char):
    if char==' ': return 'none'
    row=slot//5
    field=('weekdayLetters' if row==0 else ('dateDigits' if char.isdigit() else 'monthLetters') if row==1 else 'yearDigits' if row==2 else 'separator' if row==3 else 'colon' if char==':' else 'timeDigits')
    return palette[field]


SLOTS={'corners':(0,4,20,24),'middleEdges':(2,10,14,22),
       'wings':(1,9,15,23,3,5,19,21),'axialCenters':(7,11,13,17),'diagonalCenters':(6,8,16,18)}


def target_projections(day_padding='zero',hour_padding='zero',separator_style='five',row4_artwork=None,year_range=(2020,2049),year_fields=None):
    require(day_padding in ('zero','space') and hour_padding in ('zero','space') and separator_style in ('five','three'),'Unknown display format')
    if row4_artwork is not None:
        require(separator_style=='three' and isinstance(row4_artwork,list) and len(row4_artwork)==3 and len(set(row4_artwork))==3 and all(isinstance(v,str) and v for v in row4_artwork),'Artwork must be three distinct immutable images with blank outer positions')
    dates={k:set() for k in SLOTS}
    times={k:set() for k in SLOTS}
    require(len(year_range)==2 and 1<=year_range[0]<=year_range[1]<=9998,'Invalid year range')
    if year_fields is not None:
        require(set(year_fields)=={'thousands','hundreds'},'Unknown split-year fields')
        require(year_fields['thousands']==[' ', '1', '2'] and len(set(year_fields['hundreds']))==len(year_fields['hundreds']) and all(c in '0123456789' for c in year_fields['hundreds']),'Invalid split-year vocabulary')
        years=[y for y in range(1,3000) if (' ' if y<1000 else str(y//1000)) in year_fields['thousands'] and str(y//100%10) in year_fields['hundreds']]
    else:years=range(year_range[0],year_range[1]+1)
    weekdays='MON DIE MIT DON FRE SAM SON'.split()
    months='JAN FEB MÄR APR MAI JUN JUL AUG SEP OKT NOV DEZ'.split()
    for year in years:
        day=dt.date(year,1,1)
        while day<dt.date(year+1,1,1):
            year_text=((' ' if year<1000 else str(year//1000))+str(year//100%10)+' '+f'{year%100:02}') if year_fields is not None else ' '+f'{year:04}'
            text=weekdays[day.weekday()]+'  '+(f'{day.day:2}' if day_padding=='space' else f'{day.day:02}')+months[day.month-1]+year_text+(' ─── ' if separator_style=='three' else '─────')
            require(text[12]==(' ' if year_fields is not None else '0'),'Front fixed center must match year layout')
            for k,positions in SLOTS.items():
                dates[k].add(tuple(text[i] for i in positions if i<20))
            day+=dt.timedelta(days=1)
    for minute in range(1440):
        hour=f'{minute//60:2}' if hour_padding=='space' else f'{minute//60:02}'
        text=hour+f':{minute%60:02}'
        for k,positions in SLOTS.items():
            times[k].add(tuple(text[i-20] for i in positions if i>=20))
    result={}
    for k,positions in SLOTS.items():
        result[k]=[]
        for d,t in itertools.product(dates[k],times[k]):
            di,ti=iter(d),iter(t)
            target=tuple(zip(positions,(next(di) if i<20 else next(ti) for i in positions)))
            if row4_artwork is not None:
                target=tuple((slot,row4_artwork[slot-16] if 16<=slot<=18 else char) for slot,char in target)
            result[k].append(target)
    return result


def verify_design_and_group(report, *, reuse_group=False, target_patterns=None):
    global _GROUP_CERTIFICATE
    require(sympy.__version__=='1.14.0','Install pinned requirements-verifier.txt')
    start=time.monotonic()
    # Independent sticker lattice and IDs, unrelated to the face-order IDs of D.
    lattice=[]
    for p in itertools.product(range(-2,3),repeat=3):
        for n in UNITS:
            if dot(p,n)==2:
                lattice.append((p,n))
    require(len(lattice)==150,'Lattice inventory')
    idx={s:i for i,s in enumerate(lattice)}
    design=report['design']['stickers']
    require(len(design)==150 and sorted(s['id'] for s in design)==list(range(150)),'Fixed design must label all 150 stickers')
    design_by_slot={(tuple(s['position']),tuple(s['normal'])):s for s in design}
    require(set(design_by_slot)==set(lattice),'Design is not the physical sticker lattice')
    by_piece=collections.defaultdict(list)
    for s in design:
        p,n,up=tuple(s['position']),tuple(s['normal']),tuple(s['up'])
        require(up in UNITS and dot(n,up)==0,'Invalid printed glyph tangent')
        require(s['symbol'] in report['glyphModel']['quarterTurns'],'Unknown printed symbol')
        by_piece[p].append(s)
    require(len(by_piece)==98,'Full physical cubie count')
    fixed=design_by_slot[((0,0,2),(0,0,1))]
    split_year=report.get('yearFields') is not None
    require(fixed['symbol']==(' ' if split_year else '0'),'Front fixed center printing')
    require(report['glyphModel']['quarterTurns']['0']==[0,1,2,3] and report['glyphModel']['quarterTurns'][' ']==[0,1,2,3],'Fixed-center spins must be optically irrelevant')
    if 'palette' in report:
        require(fixed.get('ink')==('none' if split_year else report['palette']['yearDigits']),'Front fixed-center ink')
        require(all(s.get('ink')=='none' for s in design if s['symbol']==' '),'Blank printing has no ink')
    require(all(s['symbol']==' ' for s in design if piece_class(s['position'])=='fixedCenters' and s is not fixed),'Other fixed centers must be blank')

    # Actual rigid poses, not the claimed targetSlots fields, decide matching.
    # No two slots may select stickers of the same physical cubie.
    allowed=report.get('matchingQuarterTurns',report['glyphModel']['quarterTurns'])
    require(all(set(q)<=set(report['glyphModel']['quarterTurns'][c]) for c,q in allowed.items()),'Matching cannot admit an optically invalid orientation')
    ignored=set(report.get('ignoredStickerIds',[]))
    require(ignored<=set(range(150)) and fixed['id'] not in ignored,'Invalid supposedly unused printing positions')
    candidates={}
    for p,stickers in by_piece.items():
        for s in stickers:
            n,up=tuple(s['normal']),tuple(s['up'])
            if s['id'] in ignored:
                continue
            if piece_class(p)=='fixedCenters':
                continue
            destinations=collections.defaultdict(set)
            for R in ROTATIONS:
                dst,normal,tangent=rotate(p,R),rotate(n,R),rotate(up,R)
                destinations[(dst,normal)].add(tangent)
                if normal!=(0,0,1):
                    continue
                q={(0,1,0):0,(-1,0,0):1,(0,-1,0):2,(1,0,0):3}[tangent]
                if q in allowed[s['symbol']]:
                    slot=(2-dst[1])*5+dst[0]+2
                    if 'palette' not in report or s.get('ink')==palette_ink(report['palette'],slot,s['symbol']):
                        candidates.setdefault((slot,s['symbol']),set()).add(p)
            # A nonfixed physical sticker's in-plane orientation is fixed by
            # its source and destination facelets; the 150-point action loses
            # no extra glyph-spin variable.
            require(all(len(t)==1 for t in destinations.values()),'Unmodeled nonfixed sticker spin')
    targets=(target_projections(report.get('dayPadding','zero'),report.get('hourPadding','zero'),report.get('separatorStyle','five'),report.get('row4Artwork'),report.get('yearRange',(2020,2049)),report.get('yearFields'))
             if target_patterns is None else target_patterns)
    require(set(targets)==set(SLOTS),'Every moving cubie class needs target coverage')
    for klass,patterns in targets.items():
        require(patterns and all(tuple(slot for slot,_ in target)==SLOTS[klass] for target in patterns),'Target projection positions must match the physical front')
    checked={}
    for k,patterns in targets.items():
        for target in patterns:
            used=set()
            order=sorted(target,key=lambda t:len(candidates.get(t,())))
            def match(i):
                if i==len(order):
                    return True
                for p in candidates.get(order[i],set()):
                    if p not in used:
                        used.add(p)
                        if match(i+1):
                            return True
                        used.remove(p)
                return False
            require(match(0),f'No rigid printed-cubie matching for {k}: {target}')
        checked[k]=len(patterns)
        require(report['design']['packings'][k]['projectedTargets']==len(patterns),'Projection certificate count')

    if reuse_group:
        require(_GROUP_CERTIFICATE is not None,'A serialized group certificate is not enough: verify the group in this process first')
        certificate=copy.deepcopy(_GROUP_CERTIFICATE)
        # Geometry, active front positions, and local placement sizes are fixed;
        # target cardinalities may change, and were all independently matched above.
        certificate['checkedProjectionCounts']=checked
        certificate['fixedCenterReason']=('all six fixed-center stickers are blank; all spins optically equivalent' if split_year else 'front zero is circular; other five fixed-center stickers are blank; all spins optically equivalent')
        return certificate

    generators=[]
    labels=[]
    for axis in range(3):
        for layer in (-2,-1,1,2):
            generators.append(Permutation([idx[(quarter(p,axis),quarter(n,axis)) if p[axis]==layer else (p,n)] for p,n in lattice]))
            labels.append((axis,layer))
    full=PermutationGroup(generators)
    classes=list(SLOTS)
    domains={k:[i for i,(p,n) in enumerate(lattice) if piece_class(p)==k and (k!='wings' or chirality(p,n)==1)] for k in classes}
    # Parities are on physical cubies, including coupled wing pairs.
    parities={k:[] for k in classes}
    for g in generators:
        for k in classes:
            positions=sorted({lattice[i][0] for i in domains[k]})
            reps=[next(i for i in domains[k] if lattice[i][0]==p) for p in positions]
            image=[positions.index(lattice[g(i)][0]) for i in reps]
            sign=sum(image[i]>image[j] for i in range(len(image)) for j in range(i+1,len(image)))%2
            parities[k].append(sign)
    for j in range(12):
        c,w,m,a,d=[parities[k][j] for k in ('corners','wings','middleEdges','axialCenters','diagonalCenters')]
        require(c==m==d and a==(c^w),'Necessary global parity relations')

    local_cert={}
    product=1
    for k,ids in domains.items():
        local_index={old:new for new,old in enumerate(ids)}
        local_gens=[Permutation([local_index[g(i)] for i in ids]) for g in generators]
        local=PermutationGroup(local_gens)
        order=local.order()
        expected=(math.factorial(8)*3**7 if k=='corners' else math.factorial(12)*2**11 if k=='middleEdges' else math.factorial(24))
        require(order==expected,f'Unexpected local group order for {k}')
        product*=order
        # Schreier generators of the physical-permutation even subgroup.
        # Using the two cosets avoids an expensive generic derived subgroup.
        identity=Permutation(list(range(len(ids))))
        odd=next(g for g,bit in zip(local_gens,parities[k]) if bit)
        kernel=[]
        for representative,bit_r in ((identity,0),(odd,1)):
            for g,bit_g in zip(local_gens,parities[k]):
                kernel.append(representative*g*(odd**-1 if bit_r^bit_g else identity))
        even=PermutationGroup(kernel)
        even_order=even.order()
        require(even_order*2==order,'Even-subgroup index')
        front=[]
        for slot in SLOTS[k]:
            position=(slot%5-2,2-slot//5,2)
            source=next(i for i in ids if lattice[i][0]==position and (k=='wings' or lattice[i][1]==(0,0,1)))
            front.append(local_index[source])
        stabilizer=even.pointwise_stabilizer(front,incremental=True)
        partial_orbit=even_order//stabilizer.order()
        # Maximum number of ordered distinct-piece placements, with all
        # three corner / two middle-edge orientations retained.
        expected_orbit=(math.perm(8,4)*3**4 if k=='corners' else math.perm(12,4)*2**4 if k=='middleEdges' else math.perm(24,len(front)))
        require(partial_orbit==expected_orbit,f'Incomplete partial-placement transitivity: {k}')
        local_cert[k]=dict(order=str(order),evenOrder=str(even_order),partialPlacementOrbit=str(partial_orbit),frontPieces=len(front))

    # G is a subgroup of the parity fiber product of its local projections.
    # The three independent sign equations give index 8. Equal finite orders
    # prove G equals this whole fiber product; this is the completion step.
    print('Computing exact full labeled 5x5 group order (Schreier–Sims)...',flush=True)
    full_order=full.order()
    fiber_order=product//8
    require(full_order==fiber_order,'Global group does not fill the parity-compatible product')
    certificate=dict(method='exact Schreier–Sims and even-subgroup partial-placement transitivity',sympyVersion=sympy.__version__,
                     fullGroupOrder=str(full_order),parityFiberProductOrder=str(fiber_order),localGroups=local_cert,
                     checkedProjectionCounts=checked,
                     fixedCenterReason=('all six fixed-center stickers are blank; all spins optically equivalent' if split_year else 'front zero is circular; other five fixed-center stickers are blank; all spins optically equivalent'),
                     simultaneousCompletion=True)
    print(f'Physical design and exact simultaneous completion verified in {time.monotonic()-start:.1f}s.',flush=True)
    _GROUP_CERTIFICATE=copy.deepcopy(certificate)
    return certificate
