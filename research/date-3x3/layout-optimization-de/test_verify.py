"""Reject independent corruption controls on an actual complete capture."""
import copy
import importlib.util
import json
import sys
import tempfile
from pathlib import Path
root=Path(__file__).resolve().parent
s=importlib.util.spec_from_file_location('layout_verify',root/'verify.py');v=importlib.util.module_from_spec(s);s.loader.exec_module(v)
original=json.loads(Path(sys.argv[1]).read_text())
assert v.verify_capture(sys.argv[1])['status']=='PASS'
mutations={
 'boolean-count':lambda d:d['records'][0].update(rotations=False),
 'negative-elapsed':lambda d:d['records'][0].update(elapsedMs=-1),
 'missing-summaries':lambda d:d.update(summaries=[]),
 'duplicate-summary':lambda d:d['summaries'].__setitem__(1,copy.deepcopy(d['summaries'][0])),
 'runner-hash':lambda d:d.update(runnerSHA256='0'*64),
 'app-head':lambda d:d.update(appHead='0'*40),
 'budget':lambda d:d['records'][0]['diagnostics'].update(maximumNodes=100001),
 'nonfinite-elapsed':lambda d:d['records'][0].update(elapsedMs=float('nan')),
 'dirty-app':lambda d:d.update(appDirty=True),
 'input-hash':lambda d:d['inputs'][0].update(sha256='0'*64),
 'missing-request':lambda d:d['records'].pop(),
 'source-frame-hash':lambda d:d['records'][0].update(fromHash='0'*64),
 'end-frame-hash':lambda d:d['records'][0].update(endHash='0'*64),
 'move-count':lambda d:d['records'][0].update(htm=d['records'][0]['htm']+1),
 'illegal-turn':lambda d:d['records'][0].update(word='Rw'),
 'wrong-date':lambda d:d['records'][0].update(iso='2026-01-01'),
}
results={}
with tempfile.TemporaryDirectory(prefix='de-layout-corrupt-') as temp:
 for name,mutate in mutations.items():
  data=copy.deepcopy(original);mutate(data);path=Path(temp)/(name+'.json');path.write_text(json.dumps(data))
  try:v.verify_capture(path)
  except AssertionError:results[name]='REJECTED'
  else:raise AssertionError('Corruption accepted: '+name)
print(json.dumps({'status':'PASS','controls':results,'controlsRejected':len(results)},indent=2))
