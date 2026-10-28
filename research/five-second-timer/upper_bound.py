"""Independent finite structural UNSAT proof for continuous five-second 40:00.

Model: eight rigid corner cubies, 24 immutable single-digit stickers, exact
upright glyph frames in fixed MM/SS slots. No rotational/cross-digit aliases.
This proves a necessary-model obstruction, not merely sticker capacity.
It does not certify a constructive lower bound or animation performance.

To include40:00 needs23 distinct (slot,digit) classes. Only one extra face
remains, so either every required class is unique or exactly one has two
copies. Over the contained00:00..39:55 Cartesian domain, two UNIQUE classes
from different slots can never share a cubie: their digits co-occur in a target.
Thus their occupied bins are disjoint by slot. Enumerate all possible duplicate
slots and every occupancy partition at the forced eight-bin minimum. Empty
bins cannot occur because that minimum already occupies all eight bins.
Within a slot, unique digit identities are symmetric for the Cartesian domain.
The only extension-specific digit needed is D0: it is unique and in the sole D
bin in the two surviving skeletons, and conflicts with the required new A4.
"""
import itertools, json, math
from pathlib import Path

FRONT = ((-1,1,1),(1,1,1),(-1,-1,1),(1,-1,1))
COUNTS = (4,10,6,2)  # Complete Cartesian domain through39:55.

def require(ok, message):
    if not ok: raise AssertionError(message)

def dot(a,b): return sum(x*y for x,y in zip(a,b))
def cross(a,b):
    return (a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])
def transform(v, columns):
    return tuple(sum(v[j]*columns[j][i] for j in range(3)) for i in range(3))

def audit_slot_invariant():
    axes = tuple(tuple(s if i==a else 0 for i in range(3)) for a in range(3) for s in (-1,1))
    rotations = tuple((cross(u,n),u,n) for n in axes for u in axes if dot(n,u)==0)
    require(len(set(rotations))==24,'24 proper rigid rotations')
    signatures = {(p[1],p[0]):p for p in FRONT}
    count=0
    for p in itertools.product((-1,1), repeat=3):
        for n in axes:
            if dot(p,n)!=1: continue
            for u in axes:
                if dot(n,u): continue
                sig=(dot(p,u),dot(p,cross(u,n)))
                require(sig in signatures,'Every useful ink frame has one slot')
                destinations=set()
                for r in rotations:
                    rp,rn,ru=(transform(v,r) for v in (p,n,u))
                    require((dot(rp,ru),dot(rp,cross(ru,rn)))==sig,'Rigid invariant')
                    if rn==(0,0,1) and ru==(0,1,0): destinations.add(rp)
                    count+=1
                require(destinations=={signatures[sig]},'One exact upright slot per sticker')
    return count

def partitions(total, bins, low=1):
    if bins==0:
        if total==0: yield ()
        return
    for first in range(low,4):
        if first<=total:
            for rest in partitions(total-first,bins-1,first): yield (first,)+rest

def matching(candidates):
    def walk(i,used):
        if i==len(candidates): return True
        return any(walk(i+1,used|{b}) for b in candidates[i] if b not in used)
    return walk(0,set())

def audit_time_domain():
    fields=[tuple(f"{seconds//60:02d}{seconds%60:02d}") for seconds in range(0,2400,5)]
    classes=[tuple(sorted({f[slot] for f in fields})) for slot in range(4)]
    require(tuple(map(len,classes))==COUNTS,'Domain derives exact slot-class counts')
    require(set(fields)==set(itertools.product(*classes)),'All480 Cartesian states exactly cover00:00..39:55')
    extra=tuple(f"{2400//60:02d}{2400%60:02d}")
    labels={(slot,d) for f in fields+[extra] for slot,d in enumerate(f)}
    require(len(labels)==23 and extra==tuple('4000'),'40:00 requires23 classes')
    return len(fields)

def audit_abstract_construction():
    bins=[[(0,d) for d in '012'],[(1,d) for d in '012'],[(1,d) for d in '345'],
          [(1,'6'),(1,'7'),(0,'3')],[(1,'8'),(1,'9'),(0,'3')],
          [(2,d) for d in '012'],[(2,d) for d in '345'],[(3,'0'),(3,'5'),(3,'0')]]
    require(len(bins)==8 and all(len(b)==3 for b in bins),'24 candidate faces')
    for seconds in range(0,2400,5):
        digits=f"{seconds//60:02d}{seconds%60:02d}"
        choices=[tuple(b for b,items in enumerate(bins) if (slot,digit) in items) for slot,digit in enumerate(digits)]
        require(matching(choices),'Candidate distinct-cubie matching at every five-second display')
    return {'status':'UNKNOWN','abstractMatchingTargets':480,'maximumCandidateSeconds':2395,
            'reason':'Abstract assignment independently covers all targets; actual physical print/up frames and legal move witness replay are still required for SAT.',
            'bins':bins}

def audit_upper_bound():
    require(sum(COUNTS)+1==23,'40:00 introduces new minute-tens4 class')
    require(24-23==1,'At most one extra required-class copy')
    cases=[];tested=0;survivors=[]
    # None: no old class duplicated (also covers duplicated A4 or unused face).
    for duplicated in (None,0,1,2,3):
        unique=tuple(n-(i==duplicated) for i,n in enumerate(COUNTS))
        bins=tuple(math.ceil(n/3) for n in unique)
        if sum(bins)>8:
            cases.append({'duplicatedSlot':duplicated,'uniqueCounts':unique,'minimumUniqueBins':sum(bins),'elimination':'disjoint unique-slot bins exceed8'})
            continue
        require(sum(bins)==8,'Minimum fills all8 bins, no hidden spare-bin cases')
        require(duplicated in (0,1),'Only A/B duplication can survive bin lower bound')
        skeletons=0
        for grouped in itertools.product(*(tuple(partitions(n,k)) for n,k in zip(unique,bins))):
            fixed=[(slot,j,n) for slot,group in enumerate(grouped) for j,n in enumerate(group)]
            # Distinguish faces within bins here; repeated placements may collapse
            # to the same candidate bin set but exhaustive enumeration stays safe.
            free=[(b,f) for b,(_,_,n) in enumerate(fixed) for f in range(n,3)]
            require(len(free)==3,'21 unique old classes leave3 faces for q,q,A4')
            labels=[[(b,) for b,(s,_,n) in enumerate(fixed) if s==slot for _ in range(n)] for slot in range(4)]
            for copy_faces in itertools.combinations(free,2):
                tested+=1;skeletons+=1
                qbins=tuple(sorted({b for b,_ in copy_faces}))
                candidates=[list(x) for x in labels]
                candidates[duplicated].append(qbins)
                require(tuple(map(len,candidates))==COUNTS,'All old Cartesian digit classes')
                if not all(matching(t) for t in itertools.product(*candidates)):continue
                remaining=[x for x in free if x not in copy_faces]
                require(len(remaining)==1,'Exactly one newA4 sticker')
                a4=remaining[0][0]
                dbins=[b for b,(s,_,_) in enumerate(fixed) if s==3]
                require(len(dbins)==1,'Unique D0 and D5 occupy sole D bin')
                require(a4==dbins[0],'Every surviving skeleton forces newA4 onto D0/D5 cubie')
                # A4 at40:00 must coexist with D0, so repeated cubie is impossible.
                require(not matching(((a4,),(a4,))),'A4/D0 conflict independently checked')
                survivors.append({'duplicatedSlot':duplicated,'partitions':grouped,'copyBins':qbins,'newA4Bin':a4,'D0Bin':dbins[0]})
        cases.append({'duplicatedSlot':duplicated,'uniqueCounts':unique,'minimumUniqueBins':8,'copyPlacementsChecked':skeletons})
    require(tested==12,'Complete partition/face-placement census')
    require(len(survivors)==2,'Only two Cartesian-valid skeleton families')
    return {'status':'UNSAT','firstExcludedSeconds':2400,'containedCartesianTargets':audit_time_domain(),'constructiveCandidate':audit_abstract_construction(),'strictModel':'fixed24 single-digit exact-upright stickers on8 rigid corners; MM/SS five-second continuous range','slotRotationChecks':audit_slot_invariant(),'cases':cases,'copyPlacementsChecked':tested,'oldCartesianSurvivors':survivors,'reason':'All surviving layouts force new minute-tens4 and required seconds-units0 onto the same cubie at40:00.'}

if __name__=='__main__':
    result=audit_upper_bound()
    text=json.dumps(result,indent=2)
    print(text)
    if len(__import__('sys').argv)>1:Path(__import__('sys').argv[1]).write_text(text+'\n')
