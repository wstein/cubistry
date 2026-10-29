"""Summarize saved captures without conflating pilots and continuous paths."""
import hashlib
import json
import statistics
from pathlib import Path
ROOT=Path(__file__).resolve().parent
captures={}
for path in sorted((ROOT/'captures').glob('*.json')):
 data=json.loads(path.read_bytes())
 if data.get('schema')=='cubistry.de-layout-measurement':captures[path.name]=data

def metric(rows):
 times=sorted(r['elapsedMs'] for r in rows)
 return {'transitions':len(rows),'totalHTM':sum(r['htm'] for r in rows),'meanHTM':statistics.mean(r['htm'] for r in rows),'maximumHTM':max(r['htm'] for r in rows),'cubeRotations':sum(r['rotations'] for r in rows),'planningWallSeconds':sum(times)/1000,'medianPlanningMs':statistics.median(times),'p95PlanningMs':times[int(.95*(len(times)-1))]}

out=[]
for folder in sorted((ROOT/'candidates').iterdir()):
 row={'candidate':folder.name,'frontFeasibility':'UNKNOWN','paths':{}}
 coverage=folder/'coverage.json'
 if coverage.exists():
  proof=json.loads(coverage.read_bytes());row.update(frontFeasibility=proof['status'],fronts=proof['datePatternsVerified'],printingSHA256=proof['constructiveSHA256'],witnessSHA256=proof['witnessSHA256'])
 for name,data in captures.items():
  rows=[r for r in data['records'] if r['variant']==folder.name]
  if not rows:continue
  result=metric(rows)
  if data['mode']=='leap-year-forward-reverse':
   assert len(rows)==732
   result.update(forward=metric(rows[:366]),reverse=metric(rows[366:]))
  else:result['november3to4']=[r['htm'] for r in rows if r['iso']=='2026-11-04']
  row['paths'][name]=result
 out.append(row)
print(json.dumps({'scope':'Measured fixed print/catalog packages; global optimality UNKNOWN','candidates':out,'captureSHA256':{n:hashlib.sha256((ROOT/'captures'/n).read_bytes()).hexdigest() for n in captures}},indent=2))
