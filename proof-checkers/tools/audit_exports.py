#!/usr/bin/env python3
"""Compare actual complete exported frames with unchanged independent oracles."""
import argparse,hashlib,importlib.util,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
PIN='c0d0fa2fc6d692c7c89e436fe5a2670503d8a8a6c86a2cc0d1397be983832e01'
def load(name,path):
 s=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m

def wire(rows):
 return sorted([[s['id'],s['cubie'],s['p'],s['n'],s['up'],s['image']] for s in rows])
def state(rows):return tuple((s[0],s[1],tuple(s[2]),tuple(s[3]),tuple(s[4]),s[5]) for s in rows)
def main():
 p=argparse.ArgumentParser();p.add_argument('export',type=Path);p.add_argument('--research-root',type=Path,required=True);p.add_argument('--output',type=Path);a=p.parse_args()
 mp=ROOT/'proof-checkers/conformance/manifest.json';assert hashlib.sha256(mp.read_bytes()).hexdigest()==PIN;m=json.loads(mp.read_text())
 cp=ROOT/m['oraclePins']['counterPath'];wp=a.research_root/m['oraclePins']['researchOraclePath']
 assert hashlib.sha256(cp.read_bytes()).hexdigest()==m['oraclePins']['counterSHA256'];assert hashlib.sha256(wp.read_bytes()).hexdigest()==m['oraclePins']['researchOracleSHA256']
 C=load('unchanged_counter_export_oracle',cp);W=load('independent_research_export_oracle',wp)
 cases={(r['group'],r['name']):r for r in m['cases']};expected_keys=set()
 for row in m['cases']:
  if row['expectedValid']:
   if row['group']=='counter':expected_keys.update(('counter',row['name'],v) for v in range(100))
   else:expected_keys.add(('geometry',row['name'],None))
 kernel=json.loads((ROOT/m['kernel']['path']).read_text());source=state(wire(kernel['printing']));kr={str(r['i']):r for r in kernel['rows']}
 expected_keys.update(('kernel',str(r['i']),None) for r in kernel['rows']);expected_keys.update(('generators',str(i),None) for i in range(36))
 def replay(s,word):
  for token in word.split():s=W.apply(s,token,global_only=token[0] in 'xyz')
  return s
 seen=set();frames=0;counts={};source_cache={}
 with a.export.open() as f:
  for line in f:
   row=json.loads(line);group=row['group'];name=str(row['name']);value=row.get('value') if group=='counter' else None
   key=(group,name,value);assert key in expected_keys and key not in seen,('unexpected/duplicate',key);seen.add(key)
   actual=row['state'];assert isinstance(actual,list)
   for s in actual:
    assert isinstance(s,list) and len(s)==6 and type(s[0]) is int and type(s[1]) is int and type(s[5]) is str
    assert all(isinstance(v,list) and len(v)==3 and all(type(n) is int for n in v) for v in s[2:5])
   if group in ('counter','geometry'):
    item=cases[(group,name)]
    if name not in source_cache:source_cache[name]=json.loads((ROOT/item['path']).read_bytes())
    data=source_cache[name];printing=state(wire(data['printing']))
    if group=='counter':expected=C.apply(printing,data['witnesses'][value]['word'])
    elif item.get('word') is not None:
     expected=replay(printing,item['word']);assert json.loads(json.dumps(sorted(expected)))==wire(data['state'])
    else:expected=state(wire(data['state']))
   elif group=='kernel':expected=replay(source,kr[name]['word'])
   else:expected=replay(source,kernel['generators'][int(name)]['word'])
   expected=json.loads(json.dumps(sorted(expected),ensure_ascii=True))
   assert actual==expected,('full physical state mismatch',key)
   frames+=len(actual);counts[group]=counts.get(group,0)+1
 assert seen==expected_keys,('missing exports',len(expected_keys-seen))
 result={'status':'PASS_INDEPENDENT_FULL_FRAMES','records':len(seen),'fullStickerFrames':frames,'groups':counts,'exportSHA256':hashlib.sha256(a.export.read_bytes()).hexdigest(),'manifestSHA256':PIN,'counterOracleSHA256':m['oraclePins']['counterSHA256'],'researchOracleSHA256':m['oraclePins']['researchOracleSHA256']}
 if a.output:
  assert not a.output.exists();a.output.write_text(json.dumps(result,indent=2)+'\n')
 print(json.dumps(result,indent=2))
if __name__=='__main__':main()
