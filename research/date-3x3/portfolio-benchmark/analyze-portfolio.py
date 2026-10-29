"""Derived portfolio outcomes; physical validity belongs to verify.py."""
import collections,json,statistics,sys
from pathlib import Path
from hashlib import sha256
raw=Path(sys.argv[1]).read_bytes();data=json.loads(raw)
assert data['complete']
out={'captureSHA256':sha256(raw).hexdigest(),'appHead':data['manifest']['appHead'],'elapsedMs':data['elapsedMs'],'providers':{}}
for provider in data['manifest']['parameters']['providers']:
 rows=[r for r in data['cases']if r['provider']==provider]
 plans=[p for r in rows for p in r['planning']]
 ds=[p.get('diagnostics')or{}for p in plans]
 attempts=[(i,a)for d in ds for i,a in enumerate(d.get('attempts',[]))]
 counts=collections.Counter((i,a.get('attempted'),a.get('status'))for i,a in attempts)
 out['providers'][provider]={
  'groups':len(rows),'fallbackGroups':sum(r['route']=='fallback'for r in rows),
  'canceledPlans':sum(bool(p.get('providerCanceled'))for p in plans),
  'providerErrors':sum(bool(p.get('providerError')or(p.get('diagnostics')or{}).get('error'))for p in plans),
  'maximumHTM':max(r['counts']['htm']for r in rows),
  'maximumPhysicalMovesIncludingXYZ':max(r['counts']['total']for r in rows),
  'maximumReferenceEndpointTokens':max(r['referenceEndTokens']for r in rows),
  'secondAttemptImprovedCalls':sum(len(d.get('attempts',[]))>1 and d['chosenMoves']<d['attempts'][0]['moves']for d in ds),
  'secondAttemptMovesSaved':sum(d['attempts'][0]['moves']-d['chosenMoves']for d in ds if d.get('attempts')),
  'attemptOutcomes':[{'attempt':i+1,'attempted':attempted,'status':status,'count':n}for(i,attempted,status),n in counts.items()],
  'strictNativeDepthSkipCalls':sum(d.get('improvementSkippedReason')=='native-depth-not-strictly-smaller'for d in ds),
  'equalOrGreaterDepthSecondAttempts':sum(len(d.get('attempts',[]))>1 and d['attempts'][1].get('maximumDepth',-1)>=d['attempts'][0]['maximumDepth']for d in ds),
  'retainedFirstProposalCalls':sum(bool(d.get('attempts'))and d['chosenMoves']==d['attempts'][0]['moves']for d in ds),
 }
print(json.dumps(out,indent=2))
