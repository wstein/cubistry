"""Compare immutable measured V1/V2 captures without inferring latency guarantees."""
import json,sys
from pathlib import Path
from hashlib import sha256
versions=[]
for arg in sys.argv[1:]:
 raw=Path(arg).read_bytes();d=json.loads(raw)
 assert d['complete']
 versions.append((d,sha256(raw).hexdigest()))
assert len(versions)==2
old,new=versions[0][0],versions[1][0]
assert len(old['cases'])==len(new['cases'])
rows=[]
for provider in old['manifest']['parameters']['providers']:
 a=[r for r in old['cases']if r['provider']==provider];b=[r for r in new['cases']if r['provider']==provider]
 for x,y in zip(a,b):
  assert all(x[k]==y[k]for k in ['provider','design','scenario','direction','requests','fromISO','toISO'])
 def duplicate_calls(rs):
  return [(d['attempts'][1])for r in rs for p in r['planning']if(d:=p.get('diagnostics')or{}).get('attempts')and len(d['attempts'])>1 and d['attempts'][1].get('attempted')and d['attempts'][1].get('maximumDepth')==d['attempts'][0].get('maximumDepth')and d['attempts'][1].get('maximumNodes')==d['attempts'][0].get('maximumNodes')]
 duplicates=duplicate_calls(a)
 rows.append({'provider':provider,'groups':len(a),'identicalChosenWords':sum(x['word']==y['word']for x,y in zip(a,b)),'identicalFullPhysicalEndpoints':sum(x['toStateHash']==y['toStateHash']for x,y in zip(a,b)),
 'v1HTMTotal':sum(r['counts']['htm']for r in a),'v2HTMTotal':sum(r['counts']['htm']for r in b),
 'v1RequestMsTotal':sum(r['elapsedMs']for r in a),'v2RequestMsTotal':sum(r['elapsedMs']for r in b),
 'v1EqualDepthSecondNativeCalls':len(duplicates),'v1EqualDepthSecondElapsedMs':sum(d.get('elapsedMs',0)for d in duplicates),'v2EqualDepthSecondNativeCalls':len(duplicate_calls(b))})
print(json.dumps({'status':'MEASURED_COMPARISON','v1CaptureSHA256':versions[0][1],'v2CaptureSHA256':versions[1][1],'v1AppHead':old['manifest']['appHead'],'v2AppHead':new['manifest']['appHead'],'v1ElapsedMs':old['elapsedMs'],'v2ElapsedMs':new['elapsedMs'],'providers':rows,'latencyGuarantee':'UNKNOWN; shared-machine measurements and process cache/order differ'},indent=2))
