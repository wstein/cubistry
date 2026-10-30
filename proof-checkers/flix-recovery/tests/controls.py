#!/usr/bin/env python3
"""Author input mutations; launch Flix and record decisions, never compute a proof."""
import argparse, copy, hashlib, json, re, subprocess
from pathlib import Path

ROOT=Path(__file__).resolve().parents[3]
RAW=ROOT/'proof-checkers/conformance-hsm/cases'
HERE=Path(__file__).resolve().parent

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--output',type=Path,required=True); a=ap.parse_args()
    a.output.mkdir(parents=True,exist_ok=False)
    baseR=json.loads((RAW/'recovery-unsupported.json').read_text()); baseW=json.loads((RAW/'modes.json').read_text())
    cases=[]
    def add(name, change, expected='INVALID', target='r'):
        r=copy.deepcopy(baseR); w=copy.deepcopy(baseW); change(r if target=='r' else w)
        cases.append([name,json.dumps(r).encode(),json.dumps(w).encode(),expected])
    def rowset(name,key,value): add(name,lambda r:r['modes'][16].__setitem__(key,value))
    add('unknown-schema',lambda r:r.__setitem__('schema','unknown'),'UNSUPPORTED')
    add('unknown-key',lambda r:r.__setitem__('extra',0))
    add('print-binding',lambda r:r.__setitem__('printCode',r['printCode']+' '))
    add('objective',lambda r:r.__setitem__('objective','steps first'))
    add('edge-limit',lambda r:r.__setitem__('edgeLimitHTM',6))
    add('ordered-identities',lambda r:r['modes'].reverse())
    rowset('boolean-graph-count','graphNodes',True)
    rowset('selection-source','sourceDirection',-1)
    rowset('selection-traversal','traversal','inverse')
    rowset('mean-string','meanSteps','3.8677')
    for name,key in [('graph-count','graphNodes'),('edge-count','edgesAtMostLimitOrForced'),('period-count','periodNodes'),('forced-count','poseWithoutEdgeAtMostLimit'),('unreachable','unreachable'),('max-steps','maximumSteps'),('max-htm','maximumRecoveryHTM')]:
        rowset(name,key,baseR['modes'][16][key]+1)
    add('steps-histogram',lambda r:r['modes'][16]['stepsHistogram'].__setitem__('0',13))
    add('above-histogram',lambda r:r['modes'][16]['edgesAboveLimitHistogram'].__setitem__('1',253))
    add('histogram-unicode-key',lambda r:r['modes'][16]['stepsHistogram'].__setitem__('١',1))
    rowset('mean-wrong-fourth','meanSteps',baseR['modes'][16]['meanSteps']+0.0001)
    add('sample-source',lambda r:r['modes'][16]['samples'][0].__setitem__('setupFromSolved',''))
    add('sample-count',lambda r:r['modes'][16]['samples'][0].__setitem__('steps',0))
    def reorder(r):
        samples=r['modes'][16]['samples']; other=next(i for i,s in enumerate(samples) if s['steps']<samples[0]['steps']); samples[0],samples[other]=samples[other],samples[0]
    add('first-sample-maximum',reorder)
    def nonoptimal(r):
        sample=next(s for s in r['modes'][16]['samples'] if any(len(w.split())<=3 for w in s['words']))
        k=next(i for i,w in enumerate(sample['words']) if len(w.split())<=3); sample['words'][k]+=" R R'"
    add('sample-nonoptimal-triple',nonoptimal)
    add('print-frame',lambda w:w['printing'][0].__setitem__('up',[0,0,0]),target='w')
    add('period-frame',lambda w:w['modes'][0]['periodStartFrames'][0].__setitem__('up',[0,0,0]),target='w')
    add('period-closure',lambda w:w['modes'][0]['steps'][-1].__setitem__('word','R'),target='w')
    add('word-spacing',lambda w:w['modes'][0]['steps'][0].__setitem__('word','R  U'),target='w')
    add('app-selection',lambda w:w['appModes'][0].__setitem__('sourceDirection',-1),target='w')
    add('mutable-label',lambda r:r.__setitem__('label','independent label mutation accepted'),'UNKNOWN')
    # Modify number tokens directly to preserve tiny tails/scientific notation.
    for name,token,expected in [('equivalent-scientific','38677e-4','UNKNOWN'),('decimal-far-tail','3.867700000000000000000000000000000001','INVALID')]:
        payload=json.dumps(baseR)
        matches=list(re.finditer(r'"meanSteps": ([^,}]+)',payload)); m=matches[16]
        payload=payload[:m.start(1)]+token+payload[m.end(1):]
        cases.append([name,payload.encode(),json.dumps(baseW).encode(),expected])
    rawR=(RAW/'recovery-unsupported.json').read_bytes(); rawW=(RAW/'modes.json').read_bytes()
    cases.extend([
        ['duplicate-key',rawR.replace(b'"version": 1',b'"version": 1, "version": 1',1),rawW,'INVALID_JSON'],
        ['version-exponent',rawR.replace(b'"version": 1',b'"version": 1e0',1),rawW,'UNSUPPORTED'],
        ['byte-order-mark',b'\xef\xbb\xbf'+rawR,rawW,'INVALID_JSON'],
        ['invalid-utf8',rawR.replace(b'seconds-first-modes',b'\xff',1),rawW,'INVALID_JSON'],
        ['deep-json',b'['*65+b'0'+b']'*65,rawW,'INVALID_JSON'],
        ['long-number',b'1'*129,rawW,'INVALID_JSON'],
    ])
    records=[]
    for name,r,w,expected in cases:
        case=a.output/name; case.mkdir(); rp=case/'recovery.json'; wp=case/'modes.json'; rp.write_bytes(r); wp.write_bytes(w)
        command=['java','-Xmx1536m','-jar','proof-checkers/flix-recovery/artifact/flix.jar','--mode','16',str(rp),str(wp)]
        subprocess.run(['python3',str(HERE/'run.py'),'--output',str(case/'capture'),'--',*command],cwd=ROOT,check=True,stdout=subprocess.DEVNULL)
        capture=case/'capture'; out=json.loads((capture/'stdout.txt').read_text()); run=json.loads((capture/'run.json').read_text())
        passed=out['status']==expected and run['exitCode']==(0 if expected=='UNKNOWN' else 2 if expected=='UNSUPPORTED' else 1)
        record={'name':name,'expectedStatus':expected,'actualStatus':out['status'],'exitCode':run['exitCode'],'passed':passed,'inputSHA256':{'recovery':hashlib.sha256(r).hexdigest(),'modes':hashlib.sha256(w).hexdigest()},'reason':out.get('reason'),'elapsedNanoseconds':run['elapsedNanoseconds']}
        records.append(record); print(json.dumps(record),flush=True)
        if not passed: raise RuntimeError('UNKNOWN: unexpected control decision '+name)
    (a.output/'report.json').write_text(json.dumps({'valid':True,'controls':len(records),'results':records},indent=2)+'\n')
if __name__=='__main__': main()
