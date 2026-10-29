#!/usr/bin/env python3
"""Freeze data from unchanged independent Python/Research oracles, not engine code."""
import argparse,copy,hashlib,importlib.util,itertools,json,random,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
HERE=ROOT/'proof-checkers'
RESEARCH='0013522'
FACES=['U','L','F','R','B','D']
NORMALS=[(0,1,0),(-1,0,0),(0,0,1),(1,0,0),(0,0,-1),(0,-1,0)]

def sha(raw):return hashlib.sha256(raw).hexdigest()
def load_module(name,path):
 spec=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m

def extend_schema_cases(manifest):
 base=json.loads((ROOT/'proof-checkers/conformance/geometry/identity.json').read_bytes())
 rbase=json.loads((ROOT/'proof-checkers/conformance/geometry/outer-R-quarter.json').read_bytes())
 cases=manifest['cases']
 def add(name,edit,expected=False,seed=base,goal=None,literal=False):
  data=copy.deepcopy(seed);edit(data)
  path=HERE/'conformance/geometry'/(name+'.json');raw=(json.dumps(data,separators=(',',':'),ensure_ascii=not literal)+'\n').encode()
  with path.open('xb') as f:f.write(raw)
  wire=sorted((x['id'],x['cubie'],x['p'],x['n'],x['up'],x['image']) for x in data.get('state',[]) if isinstance(x,dict) and all(k in x for k in ('id','cubie','p','n','up','image'))) if isinstance(data.get('state'),list) else []
  row={'group':'geometry','name':name,'path':str(path.relative_to(ROOT)),'sha256':sha(raw),'expectedValid':expected,'expectedStateSHA256':sha(json.dumps(wire,separators=(',',':')).encode())}
  if goal is not None:row['expectedGoalMatches']=goal
  cases.append(row)
 add('unknown-geometry-schema',lambda d:d.update(schema='cubistry.marked-3x3.v999'))
 add('missing-state',lambda d:d.pop('state'))
 add('state-not-array',lambda d:d.update(state={}))
 add('missing-state-sticker',lambda d:d['state'].pop())
 add('state-cubie-identity-changed',lambda d:d['state'][0].update(cubie=25))
 add('state-image-changed',lambda d:d['state'][0].update(image='changed'))
 def boolean_coordinate(d):
  for x in d['state']:
   for i,v in enumerate(x['p']):
    if v==1:x['p'][i]=True;return
 add('boolean-positive-state-coordinate',boolean_coordinate)
 add('float-state-coordinate',lambda d:d['state'][0]['p'].__setitem__(0,float(d['state'][0]['p'][0])))
 add('invalid-state-up-axis',lambda d:d['state'][0].update(up=d['state'][0]['n'][:]))
 add('invalid-optical-period',lambda d:d.update(centerGoal=[0]*6,periods=[0,1,1,1,1,1]))
 add('invalid-optical-goal-index',lambda d:d.update(centerGoal=[4,0,0,0,0,0],periods=[4]*6))
 add('missing-source-sticker',lambda d:d['printing'].pop())
 add('wrong-source-body-group',lambda d:d['printing'][0].update(cubie=25))
 def mirror_corner(d):
  for x in d['state']:
   if x['p']==[1,1,1]:
    for k in ('p','n','up'):x[k][0],x[k][1]=x[k][1],x[k][0]
 add('reflected-corner-body',mirror_corner)
 def reflected_centers(d):
  for x in d['state']:
   if sum(v!=0 for v in x['p'])==1:
    for k in ('p','n','up'):x[k][0],x[k][1]=x[k][1],x[k][0]
 add('reflected-center-frame',reflected_centers)
 add('valid-declared-center-quarter',lambda d:d.update(centerTwists=[0,0,0,1,0,0]),True,rbase)
 add('inconsistent-declared-center-quarter',lambda d:d.update(centerTwists=[0]*6),False,rbase)
 add('valid-quarter-exact-optical-goal',lambda d:d.update(centerGoal=[0,0,0,1,0,0],periods=[4]*6),True,rbase,True)
 # Center parity repaired, but ordinary corner/edge parity still disagrees.
 odd=json.loads((ROOT/'proof-checkers/conformance/geometry/odd-corner-only-swap.json').read_bytes())
 def repair_center_parity(d):
  x=next(x for x in d['state'] if x['p']==[0,0,1] and x['n']==[0,0,1]);x['up']=[1,0,0]
 add('odd-corners-plus-center-quarter',repair_center_parity,False,odd)

 for name,image in [('unicode-bmp-image','Ä'),('unicode-supplementary-image','😀'),('unicode-control-image','\b\t\n\f\r\x00\x0b\x7f'),('unicode-quoted-image','quote\"slash/and-backslash\\')]:
  def setimage(d,image=image):
   d['printing'][0]['image']=image;d['state'][0]['image']=image
  add(name,setimage,True)

 for name,image in [('unicode-bmp-literal-image','Ä'),('unicode-supplementary-literal-image','😀')]:
  def literalimage(d,image=image):
   d['printing'][0]['image']=image;d['state'][0]['image']=image
  add(name,literalimage,True,literal=True)
 data=copy.deepcopy(base);raw=(json.dumps(data,separators=(',',':'))+'\n').encode().replace(b'sticker-0',b'\\ud800')
 path=HERE/'conformance/geometry/unpaired-surrogate-image.json'
 with path.open('xb') as f:f.write(raw)
 cases.append({'group':'geometry','name':'unpaired-surrogate-image','path':str(path.relative_to(ROOT)),'sha256':sha(raw),'expectedValid':False})
 manifest['caseCount']=len(cases);manifest['counterCaseCount']=sum(c['group']=='counter' for c in cases);manifest['geometryCaseCount']=sum(c['group']=='geometry' for c in cases)
 return manifest

def main():
 p=argparse.ArgumentParser();p.add_argument('--research-root',type=Path,required=True);a=p.parse_args()
 research=a.research_root.resolve();wpath=research/'research/date-3x3/verify_witness.py'
 pinned=subprocess.check_output(['git','show',RESEARCH+':research/date-3x3/verify_witness.py'],cwd=research)
 assert pinned==wpath.read_bytes(),'Research oracle differs from pinned revision'
 W=load_module('independent_research_oracle',wpath)
 C=load_module('unchanged_counter_oracle',ROOT/'research/counter/verify.py')
 base=json.loads((ROOT/'public/counter-proof.json').read_bytes())
 cases=[]
 def save(group,name,data,expected,**extra):
  path=HERE/'conformance'/group/(name+'.json')
  raw=data if isinstance(data,bytes) else (json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n').encode()
  with path.open('xb') as f:f.write(raw)
  row={'group':group,'name':name,'path':str(path.relative_to(ROOT)),'sha256':sha(raw),'expectedValid':expected,**extra}
  cases.append(row);return row
 def counter(name,edit=None,expected=False,policy=None,raw=None):
  data=copy.deepcopy(base)
  if edit:edit(data)
  encoded=raw if raw is not None else (json.dumps(data,separators=(',',':'))+'\n').encode()
  row=save('counter',name,encoded,expected,policy=policy or 'incumbent-parity')
  try:C.check(ROOT/row['path']);row['incumbentValid']=True
  except (AssertionError,ValueError,TypeError,KeyError,UnicodeError,OverflowError,IndexError):row['incumbentValid']=False
  if row['policy']=='incumbent-parity':assert row['incumbentValid']==expected,(name,row)
  if expected:
   d=json.loads(encoded);s=tuple((x['id'],x['cubie'],tuple(x['p']),tuple(x['n']),tuple(x['up']),x['image']) for x in d['printing'])
   states=[sorted(C.apply(s,w['word'])) for w in d['witnesses']]
   row['canonicalStateSHA256']=sha(json.dumps(states,separators=(',',':')).encode())
 counter('valid-source',expected=True)
 def reorder_and_space(d):
  d['printing'].reverse();d['unpaddedPrinting'].reverse()
  separators=[chr(v) for v in list(range(9,14))+list(range(28,33))+[0x85,0xa0,0x1680]+list(range(0x2000,0x200b))+[0x2028,0x2029,0x202f,0x205f,0x3000]]
  for i,w in enumerate(d['witnesses']):
   sep=separators[i%len(separators)];w['word']=sep+sep.join(w['word'].split())+sep
 counter('valid-reordered-arrays',reorder_and_space,True)
 counter('unknown-schema',lambda d:d.update(schema=999))
 counter('wrong-puzzle',lambda d:d.update(puzzle='5x5x5'))
 counter('missing-witnesses',lambda d:d.pop('witnesses'))
 counter('missing-sticker-up',lambda d:d['printing'][0].pop('up'))
 counter('printing-not-array',lambda d:d.update(printing={}))
 counter('missing-sticker',lambda d:d['printing'].pop())
 counter('duplicate-identity',lambda d:d['printing'].__setitem__(1,copy.deepcopy(d['printing'][0])))
 counter('out-of-range-identity',lambda d:d['printing'][0].update(id=10**100))
 counter('overflow-cubie-wrap',lambda d:d['printing'][0].update(cubie=1<<32))
 counter('overflow-coordinate-wrap',lambda d:d['printing'][0]['p'].__setitem__(0,(1<<32)-1))
 counter('overflow-witness-value-wrap',lambda d:d['witnesses'][0].update(value=1<<32))
 def duplicate_body_position(d):
  for s in d['printing']:
   if s['cubie']==1:s['p']=d['printing'][0]['p'][:]
 counter('duplicate-body-position',duplicate_body_position)

 counter('boolean-identity',lambda d:d['printing'][1].update(id=True))
 counter('boolean-cubie',lambda d:next(s for s in d['printing'] if s['cubie']==1).update(cubie=True))
 def positive_bool(d,field='printing'):
  for s in d[field]:
   for i,v in enumerate(s['p']):
    if v==1:s['p'][i]=True;return
 counter('boolean-positive-coordinate',positive_bool)
 counter('fractional-normal',lambda d:d['printing'][0].update(n=[2/3,2/3,-1/3]))
 counter('nonaxis-up',lambda d:d['printing'][0].update(up=[0,0.6,0.8]))
 counter('short-vector',lambda d:d['printing'][0].update(p=[-1,-1]))
 counter('out-of-range-position',lambda d:d['printing'][0].update(p=[2,-1,-1]))
 counter('nonoutward-normal',lambda d:d['printing'][0].update(n=[1,0,0]))
 counter('wrong-cubie-group',lambda d:d['printing'][0].update(cubie=1))
 counter('rotated-print-up',lambda d:d['printing'][0].update(up=[-x for x in d['printing'][0]['up']]))
 counter('repainted-unpadded',lambda d:d['unpaddedPrinting'][0].update(image='9'))
 counter('missing-unpadded-sticker',lambda d:d['unpaddedPrinting'].pop())
 counter('boolean-unpadded-coordinate',lambda d:positive_bool(d,'unpaddedPrinting'),policy='strict-unpadded-types')
 counter('missing-witness',lambda d:d['witnesses'].pop())
 counter('boolean-witness-value',lambda d:d['witnesses'][0].update(value=False))
 counter('duplicate-witness-value',lambda d:d['witnesses'][1].update(value=0))
 counter('illegal-wide-token',lambda d:d['witnesses'][0].update(word='Rw'))
 counter('illegal-double-suffix',lambda d:d['witnesses'][0].update(word="R2'"))
 counter('word-not-string',lambda d:d['witnesses'][0].update(word=[]))
 counter('wrong-target-word',lambda d:d['witnesses'][1].update(word=d['witnesses'][0]['word']))
 counter('float-schema',lambda d:d.update(schema=1.0),policy='strict-integer-tokens')
 raw=json.dumps(base,separators=(',',':')).encode()
 counter('exponent-schema',raw=raw.replace(b'"schema":1',b'"schema":1e0',1),policy='strict-integer-tokens')
 counter('rounded-fraction-value',raw=raw.replace(b'"value":1,',b'"value":1.00000000000000000000000000000001,',1),policy='strict-integer-tokens')
 counter('underflow-fraction-value',raw=raw.replace(b'"value":0,',b'"value":1e-999,',1),policy='strict-integer-tokens')
 counter('duplicate-object-key',raw=b'{"schema":999,'+raw[1:],policy='strict-duplicate-keys')
 counter('trailing-root',raw=raw+b'{}')
 counter('invalid-utf8',raw=raw+b'\xff')
 # Exact historical chain; data only, no checker delegates its implementation.
 random.seed(18);chain=[0]+list(range(100))+list(range(99,-1,-1))+[random.randrange(100) for _ in range(400)]
 for step in [1,-1,10,-10]*50:chain.append(min(99,max(0,chain[-1]+step)))
 chainfile=HERE/'conformance/counter-chain.json';chainfile.write_text(json.dumps(chain,separators=(',',':'))+'\n');assert len(chain)==801
 positions=tuple(itertools.product((-1,0,1),repeat=3));bodies=[p for p in positions if any(p)]
 source=[]
 for n in NORMALS:
  up=(0,0,-1) if n==(0,1,0) else (0,0,1) if n==(0,-1,0) else (0,1,0)
  for pos in positions:
   if sum(a*b for a,b in zip(pos,n))==1:
    source.append((len(source),bodies.index(pos),pos,n,up,'' if pos in NORMALS else 'sticker-'+str(len(source))))
 source=tuple(source);assert len(source)==54
 def apply(state,word):
  for token in word.split():state=W.apply(state,token,global_only=token[0] in 'xyz')
  return state
 def wire(state):return [{'id':s[0],'cubie':s[1],'p':s[2],'n':s[3],'up':s[4],'image':s[5]} for s in sorted(state)]
 def digest(state):return sha(json.dumps(sorted(state),separators=(',',':')).encode())
 def geo(name,state=None,expected=True,printing=source,word=None,**extra):
  payload={'schema':'cubistry.marked-3x3.v1','printing':wire(printing),'state':wire(source if state is None else state)}
  for k in ('centerGoal','periods'):
   if k in extra:payload[k]=extra.pop(k)
  return save('geometry',name,payload,expected,word=word,expectedStateSHA256=digest(source if state is None else state),**extra)
 geo('identity',word='')
 for face in 'RLUDFB':
  for suffix,label in [('','quarter'),("'",'inverse'),('2','half')]:
   word=face+suffix;geo('outer-'+face+'-'+label,apply(source,word),word=word)
  geo('fourfold-'+face,apply(source,' '.join([face]*4)),word=' '.join([face]*4))
 for face in 'xyz':
  for suffix,label in [('','quarter'),("'",'inverse'),('2','half')]:
   word=face+suffix;geo('whole-'+face+'-'+label,apply(source,word),word=word)
  geo('fourfold-'+face,apply(source,' '.join([face]*4)),word=' '.join([face]*4))
 frames=[];seen=set();queue=['']
 for word in queue:
  state=apply(source,word);key=tuple(s[2] for s in state)
  if key in seen:continue
  seen.add(key);frames.append(word)
  for move in ['x','y','z']:queue.append((word+' '+move).strip())
 assert len(frames)==24
 for i,word in enumerate(frames):
  geo('frame-'+str(i).zfill(2),apply(source,word),word=word)
  printing=apply(source,word);mixed="F R U' B2 L D x y'"
  geo('rotated-source-'+str(i).zfill(2),apply(printing,mixed),printing=printing,word=mixed)
 rng=random.Random(74)
 for i in range(32):
  word=' '.join(rng.choice('RLUDFBxyz')+rng.choice(['',"'",'2']) for _ in range(20))
  geo('seeded-mixed-'+str(i).zfill(2),apply(source,word),word=word)
 def body_transform(state,pos,word):
  moved=apply(tuple(s for s in state if s[2]==pos),word);byid={s[0]:s for s in moved};return tuple(byid.get(s[0],s) for s in state)
 # Whole-frame words also give all proper rigid body rotations.
 edge=(1,1,0);edge_rotation=next(w for w in frames if apply(((0,0,edge,(0,1,0),(0,0,1),''),),w)[0][2]==edge and apply(((0,0,edge,(0,1,0),(0,0,1),''),),w)[0][3]==(1,0,0))
 geo('single-edge-flip',body_transform(source,edge,edge_rotation),False)
 corner=(1,1,1);twist=next(w for w in frames if apply(((0,0,corner,(0,1,0),(0,0,1),''),),w)[0][2]==corner and apply(((0,0,corner,(0,1,0),(0,0,1),''),),w)[0][3]!=(0,1,0))
 geo('single-corner-twist',body_transform(source,corner,twist),False)
 def swap_bodies(a,b):
  parts={}
  for start,end in [(a,b),(b,a)]:
   word=next(w for w in frames if apply(((0,0,start,(0,1,0),(0,0,1),''),),w)[0][2]==end and apply(((0,0,start,(0,1,0),(0,0,1),''),),w)[0][3]==(0,1,0))
   parts.update({s[0]:s for s in apply(tuple(s for s in source if s[2]==start),word)})
  return tuple(parts.get(s[0],s) for s in source)
 geo('odd-corner-only-swap',swap_bodies((1,1,1),(-1,1,1)),False)
 geo('odd-edge-only-swap',swap_bodies((1,1,0),(-1,1,0)),False)
 center=(0,0,1);center_quarter=body_transform(source,center,'F')
 geo('isolated-center-quarter',center_quarter,False,periods=[1]*6,centerGoal=[0]*6)
 bad=list(source);s=bad[0];bad[0]=s[:4]+(tuple(-x for x in s[4]),)+s[5:];geo('nonrigid-one-sticker-up',tuple(bad),False)
 bad=list(source);bad[1]=(bad[0][0],)+bad[1][1:];geo('duplicate-state-id',tuple(bad),False)
 # Pinned generator and kernel data, never copied solver implementation.
 kernel_path=research/'research/date-3x3/consecutive-benchmark/captures/kernel-2048.json'
 raw_kernel=subprocess.check_output(['git','show',RESEARCH+':research/date-3x3/consecutive-benchmark/captures/kernel-2048.json'],cwd=research)
 assert raw_kernel==kernel_path.read_bytes()
 kernel=json.loads(raw_kernel);kernel_output={'schema':'cubistry.center-kernel.v1','printing':wire(source),'researchRevision':subprocess.check_output(['git','rev-parse',RESEARCH],cwd=research,text=True).strip(),'upstreamRawSHA256':sha(raw_kernel),'generators':kernel['statistics']['generators'],'rows':[]}
 for row in kernel['rows']:
  state=apply(source,row['word']);assert apply(state,W.inverse(row['word']))==source
  kernel_output['rows'].append({**row,'expectedStateSHA256':digest(state)})
 for generator in kernel_output['generators']:
  generator['expectedStateSHA256']=digest(apply(source,generator['word']))
 assert len(kernel_output['rows'])==2048 and len(kernel_output['generators'])==36
 half=next(g for g in kernel_output['generators'] if g['delta']==[0,0,2,0,0,0]);halfstate=apply(source,half['word'])
 geo('valid-center-half',halfstate,word=half['word'],periods=[1,1,2,1,1,1],centerGoal=[0]*6,expectedGoalMatches=True)
 geo('center-half-goal-mismatch',halfstate,word=half['word'],periods=[1,1,4,1,1,1],centerGoal=[0]*6,expectedGoalMatches=False)
 rstate=apply(source,'R');geo('valid-quarter-period-one',rstate,word='R',periods=[1]*6,centerGoal=[0]*6,expectedGoalMatches=True)
 geo('valid-quarter-period-two-mismatch',rstate,word='R',periods=[1,1,1,2,1,1],centerGoal=[0]*6,expectedGoalMatches=False)
 kernel_dest=HERE/'conformance/center-kernel.json';kernel_dest.write_text(json.dumps(kernel_output,separators=(',',':'))+'\n')
 manifest={'schema':'cubistry.proof-conformance.v1','baseline':'285e8348e35e3bfc2a974bc6d77e8d9d5baf0bd6','cases':cases,'caseCount':len(cases),'counterCaseCount':sum(c['group']=='counter' for c in cases),'geometryCaseCount':sum(c['group']=='geometry' for c in cases),'counterChain':{'path':str(chainfile.relative_to(ROOT)),'sha256':sha(chainfile.read_bytes()),'values':801,'transitionsPerFormat':800},'kernel':{'path':str(kernel_dest.relative_to(ROOT)),'sha256':sha(kernel_dest.read_bytes()),'rows':2048,'generators':36},'oraclePins':{'counterPath':'research/counter/verify.py','counterSHA256':sha((ROOT/'research/counter/verify.py').read_bytes()),'researchRevision':kernel_output['researchRevision'],'researchOraclePath':'research/date-3x3/verify_witness.py','researchOracleSHA256':sha(pinned),'originalKernelSHA256':sha(raw_kernel)}}
 manifest=extend_schema_cases(manifest)
 manifest['cases'].sort(key=lambda c:(c['group'],c['name']))
 path=HERE/'conformance/manifest.json';path.write_text(json.dumps(manifest,indent=2)+'\n')
 pin={'schema':1,'manifestSHA256':sha(path.read_bytes()),'counterCases':[c['name'] for c in cases if c['group']=='counter'],'geometryCases':[c['name'] for c in cases if c['group']=='geometry'],'kernelRows':2048,'kernelGenerators':36}
 (HERE/'conformance-pin.json').write_text(json.dumps(pin,indent=2)+'\n')
 print(json.dumps({k:manifest[k] for k in ['caseCount','counterCaseCount','geometryCaseCount']},indent=2));print('manifest SHA256',pin['manifestSHA256'])
if __name__=='__main__':main()
