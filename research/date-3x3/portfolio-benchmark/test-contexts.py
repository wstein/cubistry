"""Adversarial controls for the full54 same-source fixture certificate."""
import copy,hashlib,json,subprocess,sys,tempfile
from pathlib import Path
path=Path(sys.argv[1]);raw=path.read_bytes();data=json.loads(raw)
checker=Path(__file__).with_name('verify-contexts.py')
subprocess.run([sys.executable,str(checker),str(path)],check=True,stdout=subprocess.DEVNULL)
controls=[
 ('wrong source pose',lambda d:d['rows'][0]['fixture'].update(sourceWord='R')),
 ('wrong saved candidate',lambda d:d['rows'][0]['portfolio']['attempts'][0].update(word='R')),
 ('dishonest total node ceiling',lambda d:d['rows'][0]['portfolio'].update(maximumTotalNodes=300000)),
 ('lost default first proposal',lambda d:d['rows'][0]['baseline'].update(word='R')),
 ('false regression threshold',lambda d:d['rows'][0]['fixture'].update(expectedMoves=-1)),
]
rejected=[]
with tempfile.TemporaryDirectory()as folder:
 for name,mutate in controls:
  altered=copy.deepcopy(data);mutate(altered);p=Path(folder)/'altered.json';p.write_text(json.dumps(altered))
  result=subprocess.run([sys.executable,str(checker),str(p)],capture_output=True)
  if result.returncode==0:raise AssertionError('Accepted '+name)
  rejected.append(name)
print(json.dumps({'status':'PASS','captureSHA256':hashlib.sha256(raw).hexdigest(),'negativeControlsRejected':rejected},indent=2))
