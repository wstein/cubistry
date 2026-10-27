"""Export statistics, per-transition words, sticker tables, and vector print nets."""
from collections import Counter
import csv
import json
import math
from pathlib import Path
import statistics

HERE = Path(__file__).resolve().parent
DATA = json.loads((HERE / 'optimized.json').read_text())
SETUPS = json.loads((HERE / 'setups.json').read_text())
ROLES = ['MT', 'MU', 'ST', 'SU']
FACES = {'U': ((0,1,0),(1,0,0),(0,0,-1),(1,0)),
         'L': ((-1,0,0),(0,0,1),(0,1,0),(0,1)),
         'F': ((0,0,1),(1,0,0),(0,1,0),(1,1)),
         'R': ((1,0,0),(0,0,-1),(0,1,0),(2,1)),
         'B': ((0,0,-1),(-1,0,0),(0,1,0),(3,1)),
         'D': ((0,-1,0),(1,0,0),(0,0,1),(1,2))}
SEGMENTS = {'0':'abcdef','1':'bc','2':'abdeg','3':'abcdg','4':'bcfg',
            '5':'acdfg','6':'acdefg','7':'abc','8':'abcdefg','9':'abcdfg'}
# Original vector strokes, with a permanent asymmetric upright marker.
LINES = {'a':(30,20,70,20),'b':(78,28,78,64),'c':(78,76,78,112),
         'd':(30,120,70,120),'e':(22,76,22,112),'f':(22,28,22,64),'g':(30,70,70,70)}

def dot(a,b): return sum(x*y for x,y in zip(a,b))
def label(t): return f'{t//6:02d}:{t%6*10:02d}'
def inverse(word): return ' '.join(t if t.endswith('2') else t[:-1] if t.endswith("'") else t+"'" for t in reversed(word.split()))
def metrics(lengths):
    ordered=sorted(lengths)
    return dict(count=len(lengths),minimum=min(lengths),maximum=max(lengths),total=sum(lengths),
                mean=statistics.mean(lengths),median=statistics.median(lengths),
                p95=ordered[math.ceil(.95*len(ordered))-1],histogram=dict(sorted(Counter(lengths).items())))

def export(run):
    tag='19m50' if run['ticks']==120 else '59m50'
    words=run['optimized']['words']; rows=[]
    for tick in range(1,run['ticks']):
        word=words[tick]; kind='decade rollover' if tick%60==0 else 'minute rollover' if tick%6==0 else 'seconds only'
        rows.append(dict(fromDisplay=label(tick-1),toDisplay=label(tick),increment=word,decrement=inverse(word),
                         HTM=len(word.split()),QTM=sum(2 if t.endswith('2') else 1 for t in word.split()),category=kind))
    with (HERE/f'{tag}-transitions.csv').open('w') as f:
        writer=csv.DictWriter(f,fieldnames=list(rows[0]));writer.writeheader();writer.writerows(rows)
    sticker_rows=[];svg=['<svg xmlns="http://www.w3.org/2000/svg" width="196mm" height="162mm" viewBox="0 0 196 162">',
       f'<title>{tag} timer fixed-print net: 20 mm stickers</title>',
       f'<text x="6" y="7" font-size="4">{tag}: source-state net, outward views; print at 100%</text>']
    for face,(normal,right,up,(gx,gy)) in FACES.items():
        ox,oy=6+gx*47,18+gy*46
        svg.append(f'<text x="{ox}" y="{oy-2}" font-size="3">{face}</text>')
        for s in run['printing']:
            if tuple(s['n'])!=normal:continue
            col=(dot(s['p'],right)+1)//2;row=(1-dot(s['p'],up))//2
            rotation=round(math.degrees(math.atan2(dot(s['up'],right),dot(s['up'],up))))%360
            sticker_rows.append(dict(sticker=s['id'],cubie=s['cubie'],face=face,row=row+1,column=col+1,
                                     role=ROLES[s['slot']],digit=s['image'],clockwiseDegrees=rotation,
                                     position=json.dumps(s['p']),normal=json.dumps(s['n']),up=json.dumps(s['up'])))
            x,y=ox+21*col,oy+21*row
            svg.append(f'<g><rect x="{x}" y="{y}" width="20" height="20" fill="white" stroke="#999" stroke-width=".1"/>')
            svg.append(f'<g transform="translate({x+10} {y+10}) rotate({rotation}) translate(-7 -9.8) scale(.14)">')
            for segment in SEGMENTS[s['image']]:
                a,b,c,d=LINES[segment]
                svg.append(f'<path d="M {a} {b} L {c} {d}" fill="none" stroke="black" stroke-width="10" stroke-linecap="square"/>')
            svg.append('<path d="M 18 130 L 28 130 L 18 140 Z" fill="black"/></g></g>')
    svg.extend(['<path d="M 6 157 H 26" stroke="black" stroke-width=".3"/>',
                '<text x="30" y="158" font-size="3">20 mm calibration; asymmetric marker defines upright.</text></svg>'])
    (HERE/f'{tag}-print.svg').write_text('\n'.join(svg)+'\n')
    with (HERE/f'{tag}-stickers.csv').open('w') as f:
        writer=csv.DictWriter(f,fieldnames=list(sticker_rows[0]));writer.writeheader();writer.writerows(sorted(sticker_rows,key=lambda r:r['sticker']))
    setup=next(s for s in SETUPS['runs'] if s['ticks']==run['ticks'])
    stats=dict(tag=tag,displays=run['ticks'],HTM=metrics([r['HTM'] for r in rows]),QTM=metrics([r['QTM'] for r in rows]),
               categories={kind:metrics([r['HTM'] for r in rows if r['category']==kind]) for kind in sorted({r['category'] for r in rows})},
               directBaseline=metrics(run['baselineDirect']['lengths']),legacyHubRaw=metrics(run['legacyHub']['lengths']),
               directBaselineTotalReductionPercent=100*(run['baselineDirect']['total']-run['optimized']['total'])/run['baselineDirect']['total'],
               faceTurns=dict(sorted(Counter(t[0] for w in words[1:] for t in w.split()).items())),
               halfTurns=sum(t.endswith('2') for w in words[1:] for t in w.split()),
               maximumSetup=setup,printingByCubie={str(c):[f"{ROLES[s['slot']]}:{s['image']}" for s in run['printing'] if s['cubie']==c] for c in range(8)},
               worstTransitions=[r for r in rows if r['HTM']==run['optimized']['max']])
    return stats

stats=[export(r) for r in DATA['runs']]
(HERE/'statistics.json').write_text(json.dumps(stats,indent=2)+'\n')
lines=['# Move-optimized fixed-print 2×2 timers','',
'Both prints are **SAT**: all settled displays and every adjacent increment/decrement are independently replayed. '
'Each stored transition uses at most **5 HTM**. Global print optimality is **UNKNOWN**.','',
'## Results','',
'HTM counts each quarter, inverse, or half face turn as one move. QTM counts a half turn as two. '
'The viewing frame is fixed; whole-cube rotations are not free moves. Setup moves are excluded from cycle statistics.','',
'| Range | Displays | Adjacent edges | HTM min / median / p95 / max | Mean HTM | Total HTM | Mean QTM / max |',
'| --- | ---: | ---: | --- | ---: | ---: | --- |']
for s in stats:
    h,q=s['HTM'],s['QTM']
    lines.append(f"| 00:00–{s['tag'][:2]}:50 | {s['displays']} | {h['count']} | {h['minimum']} / {h['median']} / {h['p95']} / {h['maximum']} | {h['mean']:.3f} | {h['total']} | {q['mean']:.3f} / {q['maximum']} |")
lines+=['','Increment and decrement use the same edge words in opposite directions, so their recorded counts are identical. '
'Every decrement restores the exact previous full cube state. Mixed increment/decrement navigation therefore remains consistent. '
'At 00:00 and the upper endpoint, clamp or reject an out-of-range step; no wraparound edge is certified.','',
'## Proof and optimization boundary','',
'The independent Python verifier rebuilds a breadth-first search on all '
'`8×7×6×5×3⁴ = 136,080` legal oriented four-corner poses. Four selected, upright front stickers define the goal; '
'hidden corners are unconstrained. Each face move projects to this graph and every projected move lifts to the actual physical cube. '
'Breadth-first search therefore gives exact HTM distances to those four sticker frames, with diameter 7. '
'For duplicate digits, all distinct-cubie sticker matchings are considered. The minimum over these matchings is the exact '
'distance to any matching next display.','',
'Every increment word, including the initial zero setup, attains that distance from its actual starting state. '
'This does **not** prove that the sequence of hidden states, the reverse partial-display paths, or the print is globally optimal. '
'Reverse paths are inverses to the canonical prior states; a different valid prior display can sometimes be reached sooner. '
'The per-range verifier output reports those reverse alternatives. Summing their independent minima does not describe a single '
'alternative countdown because changing one endpoint changes subsequent starts.','',
'The seeded search makes 4,000 attempted swap trials per range (including repeated or unchanged proposals) and keeps lexicographic improvements: worst HTM first, total HTM second. '
'It swaps digit labels within their existing upright slots and selects among 18 shortest-path tie policies with one-display lookahead. '
'For 19:50, surplus minute-tens 2–5 are replaced with additional 0/1 copies before searching. '
'Cubie grouping, assigned roles, sticker slots, and print orientations stay fixed. Wider layout/orientation searches remain open.','',
'## Baselines and boundary behavior','',
'“Direct baseline” uses the initial print and tie policy zero. The improvement below combines print changes and path tie choices; '
'it is not attributed solely to printing. “Legacy hub” is the old raw inverse-source/forward-target concatenation, '
'without local cancellation, on the original print; it is an upper-bound reference, not a competitive shortest solver.','',
'| Range | Direct baseline max / total HTM | Optimized max / total | Total reduction | Legacy raw hub max / total |',
'| --- | --- | --- | ---: | --- |']
for s in stats:
    b,h=s['directBaseline'],s['legacyHubRaw']
    lines.append(f"| {s['tag']} | {b['maximum']} / {b['total']} | {s['HTM']['maximum']} / {s['HTM']['total']} | {s['directBaselineTotalReductionPercent']:.2f}% | {h['maximum']} / {h['total']} |")
for s in stats:
    tag=s['tag'];lines+=['',f'## {tag} layout and statistics','',
        f"[Printable vector net]({tag}-print.svg) · [All 24 sticker frames and orientations]({tag}-stickers.csv) · [Every transition and inverse]({tag}-transitions.csv)",'',
        '| Cubie | Three permanent sticker roles and digits |','| --- | --- |']
    for c,printing in s['printingByCubie'].items():lines.append(f"| {c} | {', '.join(printing)} |")
    lines+=['','MT/MU = minute tens/units; ST/SU = second tens/units. All source geometry and upright print frames are in the candidate certificate.','',
            '| Transition class | Edges | Min | Mean HTM | Max |','| --- | ---: | ---: | ---: | ---: |']
    for kind,h in s['categories'].items():lines.append(f"| {kind} | {h['count']} | {h['minimum']} | {h['mean']:.3f} | {h['maximum']} |")
    lines+=['',f"HTM histogram: `{s['HTM']['histogram']}`. Half turns: {s['halfTurns']}. Face-turn usage: `{s['faceTurns']}`.",'',
       f"From the printed source state, initialize the exact upper endpoint with `{s['maximumSetup']['maximumWord']}` "
       f"({s['maximumSetup']['maximumHTM']} HTM). Initialize zero with `{s['maximumSetup']['zeroWord']}`. "
       'These setup paths are physically verified; the upper-end setup is not claimed shortest. Do not start the stored countdown '
       'from an arbitrary visually matching state: hidden state matters.','',
       'Worst-case examples (the CSV lists every edge):','']
    for r in s['worstTransitions'][:5]:lines.append(f"- `{r['fromDisplay']} → {r['toDisplay']}`: `{r['increment']}`; reverse: `{r['decrement']}`.")
lines+=['','## Printing and assembly','',
'Each SVG is an unfolded source-state net with outward face views: U above F, L/F/R/B across the middle, D below F. '
'The SVG uses original vector seven-segment strokes and an asymmetric permanent upright marker, so no font installation '
'or font license is needed for the digits. Face labels are assembly aids outside the stickers. '
'The sample sticker outlines are **20 mm squares** with a 20 mm calibration line. Print at 100%, then scale uniformly to '
'your actual cube sticker size; physical fit and printer tolerances have not been tested. No bleed or rounded-corner allowance '
'is included. The CSV gives clockwise digit rotation relative to each outward face view. '
'Keep all faces in the source-state arrangement during assembly; the net is not a picture of the initialized timer.','',
'The strict upright marker preserves the earlier capacity model. Normal fonts without orientation marks may have optical '
'symmetries and require a separate proof. The 59:50 capacity limit remains as established in the '
'[original capacity proof](../../../docs/TIMER_2X2.md). The 19:50 print was only certified through 19:50; '
'it intentionally uses duplicated tens 0/1 and does not retain the larger range.','',
'## Reproduction and evidence','',
'Run from `/workspace/cubistry` (or the repository root on another machine). The optimizer and verifier need only Node 24+ '
'and Python 3; the optional exact-endpoint setup generator uses the existing locked `cubing@0.66.1` dependency. '
'Both certificate generators refuse to overwrite their output paths.','',
'```sh','node research/timer-2x2/optimization/optimize.mjs /tmp/new-timer-optimization.json',
'python3 research/timer-2x2/optimization/verify.py',
"python3 -m unittest discover -s research/timer-2x2/optimization -p 'test_*.py'",
'python3 research/timer-2x2/optimization/report.py','```','',
'The seeded optimizer is deterministic. Compare regenerated prints, words, counts, and BFS fields with `optimized.json`; measured `runtimeSeconds` can differ. '
'The verifier checks the committed candidate and its SHA-bound `setups.json`; a different candidate requires new matching setups. '
'To regenerate setups, install the frozen parent dependencies with `npm ci --prefix research/timer-2x2`, then '
'run `node research/timer-2x2/optimization/setups.mjs /tmp/new-timer-setups.json /tmp/new-timer-optimization.json`. Verify a fresh pair with `python3 research/timer-2x2/optimization/verify.py /tmp/new-timer-optimization.json /tmp/new-timer-setups.json`.','',
'[Candidate certificate](optimized.json) · [Independent verification](verification.json) · '
'[Detailed statistics](statistics.json) · [Manifest and hashes](manifest.json)','',
'No elapsed-time or human turning-speed guarantee is made. Five HTM within a ten-second interval is a move budget, '
'not a measured usability result. A browser animation and physical build remain untested.']
(HERE/'REPORT.md').write_text('\n'.join(lines)+'\n')
