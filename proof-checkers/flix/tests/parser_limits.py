#!/usr/bin/env python3
"""Exercise declared raw resource limits without changing certificate semantics."""
import json
import subprocess
import tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
JAR=ROOT/'proof-checkers/flix/artifact/flix.jar'
RAW=(ROOT/'public/counter-proof.json').read_text().rstrip()
DIGEST='56bf3dc8ba791d5d70a18486970b6c6297895f0be7f4c59a1c699c96dcebb9f5'

def main():
    cases=[]
    def metadata(name,raw,valid):
        cases.append((name,RAW[:-1]+',"_metadata":'+raw+'}',valid))
    metadata('depth-64','['*63+'0'+']'*63,True)
    metadata('depth-65','['*64+'0'+']'*64,False)
    metadata('positive-number-128','1'*128,True)
    metadata('positive-number-129','1'*129,False)
    metadata('negative-number-128','-'+'1'*127,True)
    metadata('negative-number-129','-'+'1'*128,False)
    metadata('decimal-number-128','1.'+'1'*126,True)
    metadata('decimal-number-129','1.'+'1'*127,False)
    metadata('unpaired-unknown-string','"\\ud800"',False)
    metadata('valid-supplementary-unknown-string','"\\ud83d\\ude00"',True)
    cases.append(('long-informational-key',RAW[:-1]+','+json.dumps('k'*60000)+':0}',True))
    with tempfile.TemporaryDirectory() as directory:
        for name,raw,valid in cases:
            path=Path(directory)/(name+'.json');path.write_text(raw)
            p=subprocess.run(['java','-Xmx768m','-jar',str(JAR),'counter',str(path),str(ROOT)],capture_output=True,text=True,timeout=60)
            result=json.loads(p.stdout)
            assert result['valid'] is valid,(name,result)
            if valid:
                assert p.returncode==0 and result['canonicalStateSHA256']==DIGEST,(name,result)
            else:
                assert p.returncode==1 and result['status']=='INVALID_JSON',(name,result,p.returncode)
    print(json.dumps({'status':'PASS','rawBoundaryCases':len(cases),'limits':'16 MiB input, 64 container depth, 128 raw numeric bytes; no hidden 50k member-name limit'}))

if __name__=='__main__':main()
