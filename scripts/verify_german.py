"""Independent positive verifier: rigid glyph poses, finite target cover,
then exact simultaneous reachability in the labeled 5x5 move group.
No source geometry, move tables, or matching code is imported from JS/ReScript.
"""
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


SLOTS={'corners':(0,4,20,24),'middleEdges':(2,10,14,22),
       'wings':(1,9,15,23,3,5,19,21),'axialCenters':(7,11,13,17),'diagonalCenters':(6,8,16,18)}


def target_projections():
    dates={k:set() for k in SLOTS}
    times={k:set() for k in SLOTS}
    day=dt.date(2020,1,1)
    weekdays='MON DIE MIT DON FRE SAM SON'.split()
    months='JAN FEB MÄR APR MAI JUN JUL AUG SEP OKT NOV DEZ'.split()
    while day<dt.date(2050,1,1):
        text=weekdays[day.weekday()]+'  '+f'{day.day:02}'+months[day.month-1]+' '+str(day.year)+'─────'
        require(text[12]=='0','Front fixed center must be zero')
        for k,positions in SLOTS.items():
            dates[k].add(tuple(text[i] for i in positions if i<20))
        day+=dt.timedelta(days=1)
    for minute in range(1440):
        text=f'{minute//60:02}:{minute%60:02}'
        for k,positions in SLOTS.items():
            times[k].add(tuple(text[i-20] for i in positions if i>=20))
    result={}
    for k,positions in SLOTS.items():
        result[k]=[]
        for d,t in itertools.product(dates[k],times[k]):
            di,ti=iter(d),iter(t)
            result[k].append(tuple(zip(positions,(next(di) if i<20 else next(ti) for i in positions))))
    return result


def verify_design_and_group(report):
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
    require(fixed['symbol']=='0','Front fixed center printing')
    require(all(s['symbol']==' ' for s in design if piece_class(s['position'])=='fixedCenters' and s is not fixed),'Other fixed centers must be blank')

    # Actual rigid poses, not the claimed targetSlots fields, decide matching.
    # No two slots may select stickers of the same physical cubie.
    candidates={}
    for p,stickers in by_piece.items():
        for s in stickers:
            n,up=tuple(s['normal']),tuple(s['up'])
            if piece_class(p)=='fixedCenters':
                continue
            destinations=collections.defaultdict(set)
            for R in ROTATIONS:
                dst,normal,tangent=rotate(p,R),rotate(n,R),rotate(up,R)
                destinations[(dst,normal)].add(tangent)
                if normal!=(0,0,1):
                    continue
                q={(0,1,0):0,(-1,0,0):1,(0,-1,0):2,(1,0,0):3}[tangent]
                if q in report['glyphModel']['quarterTurns'][s['symbol']]:
                    slot=(2-dst[1])*5+dst[0]+2
                    candidates.setdefault((slot,s['symbol']),set()).add(p)
            # A nonfixed physical sticker's in-plane orientation is fixed by
            # its source and destination facelets; the 150-point action loses
            # no extra glyph-spin variable.
            require(all(len(t)==1 for t in destinations.values()),'Unmodeled nonfixed sticker spin')
    targets=target_projections()
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
                     fixedCenterReason='front zero is circular; other five fixed-center stickers are blank; all spins optically equivalent',
                     simultaneousCompletion=True)
    print(f'Physical design and exact simultaneous completion verified in {time.monotonic()-start:.1f}s.',flush=True)
    return certificate
