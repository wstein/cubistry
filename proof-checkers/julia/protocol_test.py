#!/usr/bin/env python3
"""Exercise real checker process exit classes and resource-pin failure."""
import argparse,json,os,subprocess,tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]

def main():
 p=argparse.ArgumentParser();p.add_argument('--julia',required=True);p.add_argument('--output',type=Path);a=p.parse_args()
 checker=ROOT/'julia/check.jl';repo=ROOT.parent;prefix=[a.julia,'--startup-file=no','--optimize=0','--project='+str(ROOT/'julia'),str(checker)]
 cases=[('unknown-command',['bogus',str(repo/'public/counter-proof.json')],2,'UNSUPPORTED'),('missing-arguments',[],2,'UNSUPPORTED'),('missing-input',['counter','/tmp/cubistry-definitely-missing-proof.json'],3,'ERROR'),('invalid-certificate',['counter',str(ROOT/'conformance/counter/boolean-identity.json')],1,'INVALID')]
 results=[]
 for name,args,code,status in cases:
  run=subprocess.run(prefix+args,cwd=repo,text=True,capture_output=True,timeout=60);data=json.loads(run.stdout);assert run.returncode==code and data['status']==status and not data['valid'],(name,run.returncode,data)
  results.append({'name':name,'exitCode':run.returncode,'status':data['status']})
 with tempfile.TemporaryDirectory() as temporary:
  fake=Path(temporary);target=fake/'proof-checkers/conformance';target.mkdir(parents=True);(target/'counter-chain.json').write_bytes((ROOT/'conformance/counter-chain.json').read_bytes()+b' ')
  run=subprocess.run(prefix+['counter',str(repo/'public/counter-proof.json'),str(fake)],cwd=repo,text=True,capture_output=True,timeout=60);data=json.loads(run.stdout);assert run.returncode==3 and data['status']=='ERROR' and data['diagnosticCode']=='CORPUS_ERROR',data
  results.append({'name':'tampered-direct-counter-chain','exitCode':run.returncode,'status':data['status']})
 report={'status':'PASS','cases':results}
 if a.output:
  assert not a.output.exists();a.output.write_text(json.dumps(report,indent=2)+'\n')
 print(json.dumps(report,indent=2))
if __name__=='__main__':main()
