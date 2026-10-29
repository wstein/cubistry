#!/usr/bin/env python3
"""Check frozen data identity/counts without importing either checker engine."""
import hashlib,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
PIN='e375a0e722af3c121e77efb1038826dae8d81053927d2b12eb5a826e06e6f919'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
 manifest=ROOT/'proof-checkers/conformance/manifest.json';assert sha(manifest)==PIN,'Changed conformance manifest'
 data=json.loads(manifest.read_text());pin=json.loads((ROOT/'proof-checkers/conformance-pin.json').read_text())
 assert pin['manifestSHA256']==PIN and data['caseCount']==188
 for group,count in [('counter',41),('geometry',147)]:
  rows=[r for r in data['cases'] if r['group']==group];assert len(rows)==count
  assert len({r['name'] for r in rows})==count
  assert sorted(r['name'] for r in rows)==sorted(pin[group+'Cases'])
  assert {p.name for p in (ROOT/'proof-checkers/conformance'/group).glob('*.json')}=={r['name']+'.json' for r in rows}
 for row in data['cases']:
  path=(ROOT/row['path']).resolve();assert path.is_relative_to(ROOT)
  assert sha(path)==row['sha256'],row['name']
 for field in ['counterChain','kernel']:
  row=data[field];assert sha(ROOT/row['path'])==row['sha256']
 kernel=json.loads((ROOT/data['kernel']['path']).read_text());assert len(kernel['rows'])==2048 and len(kernel['generators'])==36
 assert {r['i'] for r in kernel['rows']}=={i for i in range(4096) if sum((i>>(2*j))&3 for j in range(6))%2==0}
 assert all(r['i']==sum(v<<(2*j) for j,v in enumerate(r['o'])) for r in kernel['rows'])
 chain=json.loads((ROOT/data['counterChain']['path']).read_text());assert len(chain)==801
 print(json.dumps({'status':'PASS_DATA_PINS','cases':188,'counter':41,'geometry':147,'kernel':2048,'generators':36,'chainValues':801,'manifestSHA256':PIN},indent=2))
if __name__=='__main__':main()
