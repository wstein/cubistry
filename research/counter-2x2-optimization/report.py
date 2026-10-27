"""Export the fixed-title counter's vector print, sticker layout, and statistics."""
from collections import Counter
import csv
import json
import math
from pathlib import Path
import statistics

HERE=Path(__file__).resolve().parent
DATA=json.loads((HERE/'optimized.json').read_text())
RUN=DATA['runs'][0]
SETUP=json.loads((HERE/'setups.json').read_text())['runs'][0]
ROLES=['TL','TR','DT','DU']
FACES={'U':((0,1,0),(1,0,0),(0,0,-1),(1,0)),
       'L':((-1,0,0),(0,0,1),(0,1,0),(0,1)),
       'F':((0,0,1),(1,0,0),(0,1,0),(1,1)),
       'R':((1,0,0),(0,0,-1),(0,1,0),(2,1)),
       'B':((0,0,-1),(-1,0,0),(0,1,0),(3,1)),
       'D':((0,-1,0),(1,0,0),(0,0,1),(1,2))}
SEGMENTS={'0':'abcdef','1':'bc','2':'abdeg','3':'abcdg','4':'bcfg','5':'acdfg','6':'acdefg','7':'abc','8':'abcdefg','9':'abcdfg'}
LINES={'a':(30,20,70,20),'b':(78,28,78,64),'c':(78,76,78,112),'d':(30,120,70,120),'e':(22,76,22,112),'f':(22,28,22,64),'g':(30,70,70,70)}
# Original vector letter strokes; no installed font is needed for sticker artwork.
LETTERS={'C':'M10 0 H0 V14 H10','O':'M0 0 H10 V14 H0 Z','U':'M0 0 V14 H10 V0',
 'N':'M0 14 V0 L10 14 V0','T':'M0 0 H10 M5 0 V14','E':'M10 0 H0 V14 H10 M0 7 H8',
 'R':'M0 14 V0 H10 V7 H0 M4 7 L10 14','B':'M0 0 V14 H8 L10 12 V9 L8 7 H0 M8 7 L10 5 V2 L8 0 H0',
 'A':'M0 14 V0 H10 V14 M0 7 H10','K':'M0 0 V14 M10 0 L0 7 L10 14',
 'M':'M0 14 V0 L5 7 L10 0 V14','I':'M0 0 H10 M5 0 V14 M0 14 H10','S':'M10 0 H0 V7 H10 V14 H0'}
TITLE=['COUNTER']

def dot(a,b):return sum(x*y for x,y in zip(a,b))
def inverse(word):return ' '.join(t if t.endswith('2') else t[:-1] if t.endswith("'") else t+"'" for t in reversed(word.split()))
def metrics(values):
    ordered=sorted(values)
    return dict(count=len(values),minimum=min(values),maximum=max(values),mean=statistics.mean(values),
                median=statistics.median(values),p95=ordered[math.ceil(.95*len(values))-1],total=sum(values),
                histogram=dict(sorted(Counter(values).items())))

def title_strokes():
    paths=[]
    for row,text in enumerate(TITLE):
        scale=2;left=(200-(len(text)*13-3)*scale)/2
        top=36 if len(TITLE)==1 else 16+row*40
        for index,letter in enumerate(text):
            paths.append(f'<path d="{LETTERS[letter]}" transform="translate({left+index*13*scale} {top}) scale({scale})" fill="none" stroke="black" stroke-width="1.3" stroke-linejoin="round"/>')
    return ''.join(paths)

rows=[]
for value,word in enumerate(RUN['optimized']['words'][1:],1):
    rows.append(dict(fromValue=f'{value-1:02d}',toValue=f'{value:02d}',increment=word,decrement=inverse(word),
                     HTM=len(word.split()),QTM=sum(2 if t.endswith('2') else 1 for t in word.split()),
                     category='tens rollover' if value%10==0 else 'units only'))
with (HERE/'transitions.csv').open('w') as f:
    writer=csv.DictWriter(f,fieldnames=list(rows[0]),lineterminator='\n');writer.writeheader();writer.writerows(rows)
svg=['<svg xmlns="http://www.w3.org/2000/svg" width="196mm" height="162mm" viewBox="0 0 196 162">',
     '<title>Fixed-title 00-99 counter: 20 mm sticker source net</title>',
     '<text x="6" y="7" font-size="4">00-99 COUNTER: source net, outward views; print at 100%</text>']
stickers=[]
for face,(normal,right,up,(gx,gy)) in FACES.items():
    ox,oy=6+gx*47,18+gy*46
    svg.append(f'<text x="{ox}" y="{oy-2}" font-size="3">{face}</text>')
    for s in RUN['printing']:
        if tuple(s['n'])!=normal:continue
        col=(dot(s['p'],right)+1)//2;row=(1-dot(s['p'],up))//2
        angle=round(math.degrees(math.atan2(dot(s['up'],right),dot(s['up'],up))))%360
        stickers.append(dict(sticker=s['id'],cubie=s['cubie'],face=face,row=row+1,column=col+1,
                             role=ROLES[s['slot']],image=s['image'],clockwiseDegrees=angle,
                             position=json.dumps(s['p']),normal=json.dumps(s['n']),up=json.dumps(s['up'])))
        x,y=ox+21*col,oy+21*row
        svg.append(f'<rect x="{x}" y="{y}" width="20" height="20" fill="white" stroke="#999" stroke-width=".1"/>')
        if s['slot']<2:
            clip=f"title{s['id']}"
            svg.append(f'<g transform="translate({x+10} {y+10}) rotate({angle}) translate(-10 -10) scale(.2)"><defs><clipPath id="{clip}"><path d="M0 0 H100 V100 H0 Z"/></clipPath></defs><g clip-path="url(#{clip})"><g transform="translate({-100*s["slot"]} 0)">{title_strokes()}</g></g><path d="M6 90 H12 L6 96 Z" fill="black"/></g>')
        else:
            svg.append(f'<g transform="translate({x+10} {y+10}) rotate({angle}) translate(-7 -9.8) scale(.14)">')
            for segment in SEGMENTS[s['image']]:
                a,b,c,d=LINES[segment];svg.append(f'<path d="M{a} {b} L{c} {d}" fill="none" stroke="black" stroke-width="10" stroke-linecap="square"/>')
            svg.append('<path d="M18 130 H28 L18 140 Z" fill="black"/></g>')
svg+=['<path d="M6 157 H26" stroke="black" stroke-width=".3"/>',
       '<text x="30" y="158" font-size="3">20 mm calibration; permanent markers define upright.</text></svg>']
(HERE/'counter-print.svg').write_text('\n'.join(svg)+'\n')
with (HERE/'stickers.csv').open('w') as f:
    writer=csv.DictWriter(f,fieldnames=list(stickers[0]),lineterminator='\n');writer.writeheader();writer.writerows(sorted(stickers,key=lambda s:s['sticker']))
h=metrics([r['HTM'] for r in rows]);q=metrics([r['QTM'] for r in rows])
b=metrics(RUN['baselineDirect']['lengths']);hub=metrics(RUN['legacyHub']['lengths'])
stats=dict(HTM=h,QTM=q,baselineDirect=b,legacyHubRaw=hub,totalReductionPercent=100*(b['total']-h['total'])/b['total'],
           categories={kind:metrics([r['HTM'] for r in rows if r['category']==kind]) for kind in ['units only','tens rollover']},
           faceTurns=dict(sorted(Counter(t[0] for r in rows for t in r['increment'].split()).items())),
           halfTurns=sum(t.endswith('2') for r in rows for t in r['increment'].split()),
           titleCopies=dict(Counter(s['image'] for s in RUN['printing'] if s['slot']<2)),
           printingByCubie={str(c):[f"{ROLES[s['slot']]}:{s['image']}" for s in RUN['printing'] if s['cubie']==c] for c in range(8)},
           endpoints=SETUP,worstTransitions=[r for r in rows if r['HTM']==h['maximum']])
(HERE/'statistics.json').write_text(json.dumps(stats,indent=2)+'\n')
verification=json.loads((HERE/'verification.json').read_text())
text=['# Move-optimized 00–99 counter with a fixed upper title','',
'**SAT:** one permanent 24-sticker print supports every value from **00 through 99**, with two upright title fragments above '
'and two upright decimal digits below. Every stored ±1 edge uses at most **5 HTM**. Global print optimality remains **UNKNOWN**.','',
'## Scope','',
'This is the original counter configuration: upper-left and upper-right stickers reconstruct a fixed title; lower-left is tens '
'and lower-right is units. Values 00–09 have a leading zero. All cubies may move and intermediate displays need not be readable. '
'The title returns upright after each completed step; permanently fixed upper cubies are not required. '
'00 and 99 are endpoints: clamp or reject out-of-range operations. No 99→00 wraparound or arbitrary jump optimization is certified.','',
'The title identities remain exactly `title-left` and `title-right`, with two physical copies of each. '
'The printable sample says **COUNTER**, split into two immutable image halves. Any other fixed title split into the same two '
'square images has the same combinatorial proof if the up frames and copy locations are preserved. '
'The prior application’s dynamic title text and runtime assets are not modified.','',
'## Move statistics','',
'HTM counts quarter, inverse, and half face turns as one move. QTM counts a half turn as two. Whole-cube regrips are not free moves. '
'Setup is excluded from the following 99-edge statistics. Increment and decrement counts are identical because edges are reversed exactly.','',
'| Metric | Optimized route |','| --- | ---: |',
 f"| Displays / adjacent edges | 100 / 99 |",f"| HTM minimum / median / p95 / maximum | {h['minimum']} / {h['median']} / {h['p95']} / {h['maximum']} |",
 f"| Mean HTM | {h['mean']:.3f} |",f"| Total HTM, one full traversal | {h['total']} |",
 f"| Mean / maximum QTM | {q['mean']:.3f} / {q['maximum']} |",f"| Total QTM | {q['total']} |",'',
'| Transition class | Edges | Min HTM | Mean HTM | Max HTM |','| --- | ---: | ---: | ---: | ---: |']
for kind,m in stats['categories'].items():text.append(f"| {kind} | {m['count']} | {m['minimum']} | {m['mean']:.3f} | {m['maximum']} |")
text+=['',f"HTM histogram: `{h['histogram']}`. Half turns: {stats['halfTurns']}. Face-turn usage: `{stats['faceTurns']}`.",'',
'## Baseline comparison','',
'| Route | Worst HTM | Total HTM | Mean HTM |','| --- | ---: | ---: | ---: |',
 f"| Initial print, direct shortest paths with tie policy zero | {b['maximum']} | {b['total']} | {b['mean']:.3f} |",
 f"| Selected print and tie policy | {h['maximum']} | {h['total']} | {h['mean']:.3f} |",
 f"| Prior raw source-hub concatenation | {hub['maximum']} | {hub['total']} | {hub['mean']:.3f} |",'',
 f"Total HTM falls **{stats['totalReductionPercent']:.2f}%** relative to the direct baseline. This combines print changes and route tie choices; "
'it is not an isolated estimate of the print’s contribution. The legacy hub comparison is raw inverse/forward concatenation '
'without cancellation, not a competitive shortest-path baseline. Both baseline statistics are independently checked.','',
'## Fixed print and assembly','',
'[Printable vector source net](counter-print.svg) · [All sticker positions and rotations](stickers.csv) · '
'[Every increment and decrement word](transitions.csv)','',
'| Cubie | Three permanent sticker identities |','| --- | --- |']
for cubie,images in stats['printingByCubie'].items():text.append(f"| {cubie} | {', '.join(images)} |")
text+=['','TL/TR = title-left/title-right; DT/DU = digit tens/units. There are 20 digit stickers plus four title-fragment stickers. '
'Every digit 0–9 occurs once in each numeric slot. Only digit assignments within those slots were searched; '
'cubie groups, title stickers, and the upright-frame stencil were retained.','',
'The SVG uses original vector strokes for digits and the sample title, with permanent asymmetric markers to define upright. '
'The title is printed on the stickers, never overlaid across the cube. The four title stickers carry two identical left copies '
'and two identical right copies, with clipping at the permanent center split. '
'The net shows outward source-state faces: U above F, L/F/R/B across, D below F. '
'Stickers are sample **20 mm squares**, with a 20 mm calibration line. Scale uniformly for the physical cube. '
'Print at 100%, preserve the face arrangement, and then initialize the cube. No bleed or rounded-corner allowance is included. '
'Printer fit and physical assembly have not been tested.','',
'## Initialization and use','',f"- Exact canonical 00 setup from the printed source: `{SETUP['zeroWord']}` ({len(SETUP['zeroWord'].split())} HTM).",
 f"- Exact canonical 99 setup: `{SETUP['maximumWord']}` ({SETUP['maximumHTM']} HTM).",'',
'Setups are independently replayed, including all hidden sticker frames. The 99 setup uses the pinned complete-state solver '
'and is not claimed shortest. From canonical 00, follow the increment CSV; from canonical 99, follow the decrement words in '
'reverse row order. Reversing any edge restores its exact previous full state, so mixed ±1 navigation is consistent. '
'An arbitrary visually matching cube state need not have the required hidden arrangement.','',
'Worst-case examples (all 99 edges are in the CSV):','']
for r in stats['worstTransitions'][:6]:text.append(f"- `{r['fromValue']} → {r['toValue']}`: `{r['increment']}`; reverse: `{r['decrement']}`.")
text+=['','## Independent proof and optimization limits','',
'The Python verifier first validates the preserved original counter certificate, then replays every optimized increment, '
'every reverse edge, and both endpoint setups on 24 permanently labeled rigid sticker frames. It checks title identities, '
'both digits, upright orientation, and exact full-state restoration.','',
'The independent four-corner breadth-first search covers all `8×7×6×5×3⁴ = 136,080` legal oriented selected-corner poses. '
'Its maximum distance is seven HTM. Every projected face move lifts to the actual cube; hidden corners are unconstrained '
'in the target. Enumerating all title-copy choices with four distinct cubies gives the exact distance to any matching next display. '
'Every stored increment is verified to attain that distance from its actual starting state.','',
 f"For decrement, {verification['shortestToAnyPriorDisplayInReverse']} of 99 stored edges are also shortest to any matching prior display. "
'The remaining reversed edges intentionally restore canonical states; a different visually matching prior state can sometimes '
'be reached sooner. Those alternatives do not automatically compose into a shorter complete countdown.','',
'The search makes 8,000 seeded attempted swaps, including repeated or unchanged proposals, and tries 18 shortest-path tie '
'policies with one-display lookahead. It minimizes worst HTM first, total HTM second. '
'**Global print optimality, globally optimal hidden-state routing, and fastest physical operation remain UNKNOWN.** '
'This is a certified improved candidate, not a proof that five is the best possible worst-case count. '
'No animation, human timing, physical build, unpadded display, or wraparound is validated.','',
'## Reproduction and evidence','',
'Run from the repository root. Edge optimization needs only Node 24+; verification uses Python 3 standard library. '
'The optional exact-endpoint solver is frozen separately in this directory’s package lock. Existing timer proof tools supply '
'geometry and the independent distance graph without modifying their artifacts.','',
'```sh','node research/counter-2x2-optimization/optimize.mjs /tmp/new-counter-candidate.json',
'python3 research/counter-2x2-optimization/verify.py',
"python3 -m unittest discover -s research/counter-2x2-optimization -p 'test_*.py'",
'python3 research/counter-2x2-optimization/report.py','```','',
'The seeded search reproduces all semantic output fields; measured runtime can differ. To verify a fresh candidate, run '
'`npm ci --ignore-scripts --prefix research/counter-2x2-optimization`, then '
'`node research/counter-2x2-optimization/setups.mjs /tmp/new-counter-setups.json /tmp/new-counter-candidate.json` and '
'`python3 research/counter-2x2-optimization/verify.py /tmp/new-counter-candidate.json /tmp/new-counter-setups.json`. '
'The generators refuse to overwrite output paths.','',
'[Optimized certificate](optimized.json) · [Independent verification](verification.json) · '
'[Full statistics](statistics.json) · [Provenance and hashes](manifest.json) · '
'[Earlier timer optimization](../timer-2x2/optimization/REPORT.md)']
(HERE/'REPORT.md').write_text('\n'.join(text)+'\n')
