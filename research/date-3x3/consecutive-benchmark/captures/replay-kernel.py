import sys,json,hashlib
from pathlib import Path
# Usage: python3 replay-kernel.py kernel-2048.json
sys.path.insert(0,str(Path(__file__).resolve().parents[2]))
import verify_witness as W
p=Path(sys.argv[1]);d=json.loads(p.read_bytes())
faces=['U','L','F','R','B','D']; normals=[(0,1,0),(-1,0,0),(0,0,1),(1,0,0),(0,0,-1),(0,-1,0)]
s=[]
for n in normals:
 axis=next(i for i,x in enumerate(n) if x)
 up=(0,0,-1) if n==(0,1,0) else (0,0,1) if n==(0,-1,0) else (0,1,0)
 for pos in W.POSITIONS:
  if pos[axis]==n[axis]:s.append((len(s),len(s),pos,n,up,str(len(s))))
s=tuple(s);assert len(s)==54
centers={n: next(x for x in s if x[2]==n and x[3]==n) for n in normals}
def check(word,o):
 state=W.apply(s,word);byid={x[0]:x for x in state}
 for original in s:
  actual=byid[original[0]]
  if original[2] not in normals:assert actual==original,('noncenter',word,original,actual)
  else:
   j=normals.index(original[3]); expected=W.apply((original,),faces[j]+('' if o[j]==1 else '2' if o[j]==2 else "'")) [0] if o[j] else original
   assert actual==expected,('center',o,original,actual,expected)
 assert W.apply(state,W.inverse(word))==s,'Inverse restoration'
for row in d['rows']:
 assert row['htm']==len(W.tokens(row['word']))
 check(row['word'],row['o'])
assert len(d['rows'])==2048 and len({r['i'] for r in d['rows']})==2048
assert max(r['htm'] for r in d['rows'])==286
for g in d['statistics']['generators']:check(g['word'],g['delta'])
# Independently wrong center goals must fail even when all cubie colors agree.
neg=0
for row in d['rows'][1:7]:
 wrong=row['o'].copy();wrong[0]=(wrong[0]+2)%4
 try:check(row['word'],wrong)
 except AssertionError:neg+=1
 else:raise AssertionError('Wrong center goal accepted')
print(json.dumps({'status':'PASS','revision':d['revision'],'corpusSHA256':hashlib.sha256(p.read_bytes()).hexdigest(),'all54PhysicalFrameReplays':2048,'inverseRestorations':2048,'generators':len(d['statistics']['generators']),'maxReferenceHTM':286,'wrongCenterControlsRejected':neg,'optimality':'NOT_CLAIMED','animationBound':'NOT_CLAIMED'},indent=2))
