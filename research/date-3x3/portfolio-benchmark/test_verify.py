"""Adversarial checks against an actual complete capture, without changing it."""
import copy
import hashlib
import json
from pathlib import Path
import sys
from verify import verify

path = Path(sys.argv[1])
raw = path.read_bytes()
document = json.loads(raw)
verified = verify(document)
controls = [
    ('source identity', lambda d: d['manifest']['sources'][0]['printing'][0].update(image='X')),
    ('illegal token', lambda d: d['cases'][0].update(word='M')),
    ('wrong legal route', lambda d: d['cases'][0].update(word='R')),
    ('dishonest count', lambda d: d['cases'][0]['counts'].update(qtm=-1)),
    ('broken state chain', lambda d: d['cases'][1].update(fromStateHash='0'*64)),
    ('incorrect Gregorian request', lambda d: d['cases'][0].update(requests=['2024-01-03'])),
    ('wrong reference length', lambda d: d['cases'][0]['planning'][0].update(sourceReferenceTokens=-1)),
    ('wrong baseline count', lambda d: d['cases'][0]['planning'][0]['baselineCounts'].update(total=-1)),
    ('false interruption count', lambda d: next(r for r in d['cases'] if r['scenario']=='interrupt-move').update(obsoleteCommitted=2)),
    ('false summary', lambda d: d['statistics'][0]['htm'].update(mean=-1)),
    ('wrong saved candidate', lambda d: next(p for r in d['cases'] if r['provider']=='portfolio' for p in r['planning'] if (p.get('diagnostics') or {}).get('attempts'))['diagnostics']['attempts'][0].update(word='R')),
    ('dishonest total node ceiling', lambda d: next(p for r in d['cases'] if r['provider']=='portfolio' for p in r['planning'] if (p.get('diagnostics') or {}).get('attempts'))['diagnostics'].update(maximumTotalNodes=300000)),
    ('lost checked first candidate', lambda d: next(p for r in d['cases'] if r['provider']=='portfolio' for p in r['planning'] if (p.get('diagnostics') or {}).get('attempts'))['diagnostics']['attempts'][0].update(moves=-1)),
]
if any((series.get('providerMetadata') or {}).get('policy') == 'default-then-shorter-cap18-v2' for series in document['series']):
    def duplicate_depth(d):
        p = next(p for r in d['cases'] if r['provider']=='portfolio' for p in r['planning'] if len((p.get('diagnostics') or {}).get('attempts', [])) == 2 and p['diagnostics']['attempts'][0]['maximumDepth'] <= 18)
        p['diagnostics']['attempts'][1]['maximumDepth'] = p['diagnostics']['attempts'][0]['maximumDepth']
    def missing_skip(d):
        p = next(p for r in d['cases'] if r['provider']=='portfolio' for p in r['planning'] if (p.get('diagnostics') or {}).get('improvementSkippedReason'))
        del p['diagnostics']['improvementSkippedReason']
    controls.extend([('duplicate second native depth', duplicate_depth), ('missing explicit native-depth skip reason', missing_skip)])
rejected = []
for name, change in controls:
    altered = copy.deepcopy(document)
    change(altered)
    try:
        verify(altered)
    except (AssertionError, ValueError, KeyError, IndexError):
        rejected.append(name)
    else:
        raise AssertionError('Corruption accepted: '+name)
print(json.dumps({'status': 'PASS', 'captureSHA256': hashlib.sha256(raw).hexdigest(),
                  'verifiedCases': verified['cases'], 'negativeControlsRejected': rejected}, indent=2))
