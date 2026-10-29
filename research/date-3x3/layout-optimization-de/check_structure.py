"""Independent finite check of upright slot classes and corner body coupling."""
import hashlib
import itertools
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BASE = ROOT.parent / 'witnesses/de-2.json'
raw = BASE.read_bytes()
witness = json.loads(raw)
axes = tuple(tuple(sign if j == i else 0 for j in range(3))
             for i in range(3) for sign in (-1, 1))
def dot(a,b): return sum(x*y for x,y in zip(a,b))
def cross(a,b): return (a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])
def rot(v,r): return tuple(sum(v[j]*r[j][i] for j in range(3)) for i in range(3))
rotations = tuple((x,y,cross(x,y)) for x in axes for y in axes if dot(x,y)==0)
assert len(rotations)==24
frame_count=0
for p in itertools.product((-1,0,1),repeat=3):
 for n in axes:
  if dot(p,n)!=1: continue
  for up in axes:
   if dot(n,up): continue
   frame_count += 1
   seen=set()
   signature=(dot(p,up),dot(p,cross(up,n)))
   for r in rotations:
    q,nn,uu=rot(p,r),rot(n,r),rot(up,r)
    assert (dot(q,uu),dot(q,cross(uu,nn)))==signature
    if nn==(0,0,1) and uu==(0,1,0):
     seen.add(q)
     assert (q[1],q[0])==signature
   assert len(seen)==1
prefixes={t['cells'][0] for t in witness['targets']}
month_tokens={(slot,t['cells'][slot]) for t in witness['targets'] for slot in (6,8)}
assert len(prefixes)==4 and len(month_tokens)==18
cooccurrences={(t['cells'][0],(slot,t['cells'][slot])) for t in witness['targets'] for slot in (6,8)}
assert cooccurrences==set(itertools.product(prefixes,month_tokens))
# The18 distinct month-position tokens require6 separate corner bodies; none
# can share a body with a weekday-prefix token because all pairs co-occur.
assert len(month_tokens)//3+2==8
blank=''
def supports(rows):
 groups=[set(rows[:3]),set(rows[3:])]
 return all(any(letter in groups[a] and blank in groups[1-a] for a in (0,1)) for letter in prefixes)
one_checked=one_valid=0
for duplicate in sorted(prefixes):
 for row in set(itertools.permutations([*sorted(prefixes),duplicate,blank])):
  one_checked+=1;one_valid+=supports(row)
assert one_checked==1440 and one_valid==0
rows=set(itertools.permutations([*sorted(prefixes),blank,blank]))
valid=[r for r in rows if supports(r)]
partitions=sorted({tuple(sorted((''.join(sorted(x for x in r[:3] if x)),''.join(sorted(x for x in r[3:] if x))))) for r in valid})
assert len(rows)==360 and len(valid)==216 and len(partitions)==3
print(json.dumps({'status':'PASS','sourceSHA256':hashlib.sha256(raw).hexdigest(),'rigidRotations':24,'orientedFaceletFrames':frame_count,'rotationFrameChecks':frame_count*24,'weekdayPrefixImages':sorted(prefixes),'monthCornerPositionTokens':len(month_tokens),'allRequiredWeekdayMonthCooccurrences':len(cooccurrences),'oneBlankAssignmentsChecked':one_checked,'oneBlankAssignmentsValid':one_valid,'twoBlankAssignmentsChecked':len(rows),'twoBlankAssignmentsValid':len(valid),'weekdayBodyPairings':partitions,'globalMoveOptimality':'UNKNOWN'},indent=2))
