"""Derive diagnostic totals and compact tables; verify.py supplies physical proof."""
import collections
import hashlib
import json
from pathlib import Path
import sys

raw = Path(sys.argv[1]).read_bytes()
data = json.loads(raw)
assert data['complete'] and len(data['cases']) == data['expectedCases']
print('# Derived consecutive-calendar comparison\n')
print('Capture SHA256: `' + hashlib.sha256(raw).hexdigest() + '`.\n')
print('| Provider | Print | Direction | Mean HTM | Median | p95 | Max | Mean QTM | Mean xyz | Mean ms | p95 ms | Max ms | Max source tokens |')
print('| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |')
for s in data['statistics']:
    if s['scenario'] != 'year':
        continue
    h, e = s['htm'], s['elapsedMs']
    print(f"| {s['provider']} | {s['design']} | {'inc' if s['direction'] == 1 else 'dec'} | {h['mean']:.3f} | {h['median']} | {h['p95']} | {h['maximum']} | {s['qtm']['mean']:.3f} | {s['rotations']['mean']:.3f} | {e['mean']:.2f} | {e['p95']:.2f} | {e['maximum']:.2f} | {s['maximumSourceReferenceTokens']} |")
for provider in data['manifest']['parameters']['providers']:
    rows = [r for r in data['cases'] if r['provider'] == provider]
    plans = [plan for row in rows for plan in row['planning']]
    diagnostics = [plan.get('diagnostics') or {} for plan in plans]
    outcomes = collections.Counter((d.get('backendUsed'), d.get('attempted'), d.get('solverStatus')) for d in diagnostics)
    print('\n## ' + provider + '\n')
    print(json.dumps({
        'requestGroups': len(rows),
        'fallbackGroups': sum(r['route'] == 'fallback' for r in rows),
        'obsoletePhysicalTurns': sum(r['obsoleteCommitted'] for r in rows),
        'canceledPlans': sum(bool(plan.get('providerCanceled')) for plan in plans),
        'maximumEndpointReferenceTokens': max(r['referenceEndTokens'] for r in rows),
        'preturnReferenceReplacements': sum(len(r.get('referenceEvents', [])) for r in rows),
        'endpointReferenceReplacements': sum('endReferenceReplacement' in r for r in rows),
        'strictlyImprovedPlans': sum(d.get('chosenMoves', 0) < d.get('directMoves', 0) for d in diagnostics),
        'totalCandidateMovesSaved': sum(d.get('directMoves', 0) - d.get('chosenMoves', 0) for d in diagnostics),
        'diagnosticOutcomes': [{'backend': key[0], 'attempted': key[1], 'status': key[2], 'count': count} for key, count in outcomes.items()],
        'maximumHTMGroup': {k: max(rows, key=lambda r: r['counts']['htm'])[k] for k in ['index', 'design', 'scenario', 'fromISO', 'toISO', 'counts', 'word']},
    }, indent=2))
print('\nTimings are Node planning and immediate physical commits, not browser animation. '
      'Provider outcomes count plan calls (including obsolete requests), not groups. '
      'Candidate savings compare each proposal against its own direct candidate at the same '
      'actual pose, not against the independently chained direct series. '
      'Move optimality and universal move bounds remain UNKNOWN.')
