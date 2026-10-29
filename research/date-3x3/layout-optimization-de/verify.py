"""Independent coverage/stream verification using the unchanged Rodrigues checker."""
import datetime as dt
import hashlib
import importlib.util
import json
import sys
from collections import defaultdict
from pathlib import Path
ROOT=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('date_independent',ROOT.parent/'verify_witness.py')
V=importlib.util.module_from_spec(spec);spec.loader.exec_module(V)
def sha(raw):return hashlib.sha256(raw).hexdigest()
def stamp(state):return sha(json.dumps(state,separators=(',',':'),ensure_ascii=False).encode())
def replay(state,word):
 for token in word.split():state=V.apply(state,token,global_only=token[0] in 'xyz')
 return state

def verify_coverage(folder):
 folder=Path(folder)
 result=V.validate(folder/'witness.json',folder/'constructive.json')
 assert result['datePatternsVerified']==2562
 return result

def expected_paths(mode):
 if mode=='leap-year-forward-reverse':
  forward=[(dt.date(2024,1,1)+dt.timedelta(days=i)).isoformat() for i in range(367)]
  return {'year':forward+forward[:-1][::-1]}
 assert mode=='targeted-pilot'
 return {'november':[f'2026-11-{i:02}' for i in range(1,16)],'jump':['2026-10-29','2026-11-03','2026-11-04'],'wrap':['2024-02-28','2024-02-29','2024-03-01','2024-03-02','2024-03-03','2024-12-30','2024-12-31','2025-01-01']}

def verify_capture(path):
 raw=Path(path).read_bytes();data=json.loads(raw)
 assert data['schema']=='cubistry.de-layout-measurement'
 assert data['appDirty'] is False
 paths=expected_paths(data['mode']);inputs={}
 for row in data['inputs']:
  file=Path(row['file']);b=file.read_bytes();assert sha(b)==row['sha256'];w=json.loads(b)
  candidate,_=V.candidate_model(file.with_name('constructive.json'))
  source=V.source_state(w['printing'],candidate)
  inputs[file.parent.name]=(w,candidate,source)
 assert len(inputs)==len(data['inputs'])
 grouped=defaultdict(list)
 for row in data['records']:grouped[(row['variant'],row['scenario'])].append(row)
 assert set(grouped)=={(v,s) for v in inputs for s in paths}
 verified=0
 for (variant,scenario),rows in grouped.items():
  w,candidate,source=inputs[variant];dates=paths[scenario]
  assert [r['iso'] for r in rows]==dates[1:]
  previous=None
  for index,row in enumerate(rows):
   state=replay(source,row['sourceReference']);assert stamp(state)==row['fromHash']
   if previous is not None:assert state==previous,'Hidden state reset between requests'
   before=dt.date.fromisoformat(dates[index]);after=dt.date.fromisoformat(row['iso'])
   V.show(state,V.desired_cells(candidate,before.weekday(),before.day,before.month))
   end=replay(state,row['word']);V.show(end,V.desired_cells(candidate,after.weekday(),after.day,after.month))
   assert stamp(end)==row['endHash'];assert replay(end,V.inverse(row['word']))==state
   tokens=row['word'].split();assert row['htm']==sum(t[0] in 'RLUDFB' for t in tokens)
   assert row['rotations']==sum(t[0] in 'xyz' for t in tokens)
   previous=end;verified+=1
 for summary in data['summaries']:
  rows=[r for r in data['records'] if r['variant']==summary['variant']]
  assert summary['cases']==len(rows)
  assert summary['totalHTM']==sum(r['htm'] for r in rows)
  assert abs(summary['meanHTM']-sum(r['htm'] for r in rows)/len(rows))<1e-10
  assert summary['maxHTM']==max(r['htm'] for r in rows)
 return {'status':'PASS','captureSHA256':sha(raw),'requestsVerified':verified,'printsVerified':len(inputs),'all54Frames':True,'inverseChecks':verified,'domain':data['mode'],'optimality':'UNKNOWN'}
if __name__=='__main__':
 if sys.argv[1]=='coverage':result=verify_coverage(sys.argv[2])
 else:result=verify_capture(sys.argv[1])
 print(json.dumps(result,indent=2,ensure_ascii=False))
