"""Validate recorded endpoint observations and independently replay every physical commit."""
import hashlib,json,sys
from pathlib import Path
import verify_trace as V
HERE=Path(__file__).resolve().parent

def check():
    folder=HERE/'endpoint-timing';manifest=json.loads((folder/'manifest.json').read_text());results=[]
    for row in manifest['rows']:
        path=folder/row['file'];raw=path.read_bytes()
        assert hashlib.sha256(raw).hexdigest()==row['sha256'],'Observation integrity mismatch'
        d=json.loads(raw);o=d['observation'];physical=V.check(path)
        assert o['actualHTM']==6,'Exactly six scheduled HTM'
        assert o['preferredMilliseconds']>=o['effectiveMilliseconds']>=10,'Preference must not be slowed'
        delta=o['settledMilliseconds']-o['deadlineMilliseconds']
        if row['kind']=='current-endpoint':
            assert abs(delta)<=manifest['endpointToleranceMilliseconds'],'Endpoint outside observed tolerance'
            assert 0<=o['settledMilliseconds']-o['firstMoveMilliseconds']<=manifest['halfBudgetMilliseconds'],'Observed half-interval budget'
            assert o['movingSample']['physical']=='00:05','Movement begins before target commits'
            assert o['movingSample']['at']<o['deadlineMilliseconds'],'Movement is predictive'
        else:
            assert row['kind']=='historical-pre-endpoint' and delta>0,'Preserved negative historical observation'
        results.append(dict(file=row['file'],kind=row['kind'],actualHTM=o['actualHTM'],deadlineDeltaMilliseconds=delta,physical=physical))
    assert len([r for r in results if r['kind']=='current-endpoint'])==3
    return dict(status='PASS',featureCommit=manifest['featureCommit'],observations=results,timestampAuthenticity='Recorded browser observations, not an independently provable wall-clock guarantee')
if __name__=='__main__':print(json.dumps(check(),indent=2))
