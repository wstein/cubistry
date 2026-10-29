#!/usr/bin/env python3
"""Prepare typed Flix fixtures with expectations from the unchanged Python oracle."""
import hashlib, importlib.util, json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('python_oracle',ROOT/'research/counter/verify.py')
v=importlib.util.module_from_spec(spec);spec.loader.exec_module(v)
raw=(ROOT/'public/counter-proof.json').read_bytes();d=json.loads(raw)
source=tuple((s['id'],s['cubie'],tuple(s['p']),tuple(s['n']),tuple(s['up']),s['image']) for s in d['printing'])
def vec(x):return 'Vec.V('+','.join(map(str,x))+')'
def sticker(s):return 'Sticker.S('+','.join([str(s[0]),str(s[1]),vec(s[2]),vec(s[3]),vec(s[4]),json.dumps(s[5])])+')'
def state(s):return 'List#{'+','.join(map(sticker,s))+'}'
def move(t):
 axis,layer,direction=v.MOVES[t[0]];n=(2 if t.endswith('2') else -1 if t.endswith("'") else 1)*direction
 return f'Move.M({axis},{layer},{n})'
rows=[]
for w in d['witnesses']:
 moves='List#{'+','.join(move(t) for t in w['word'].split())+'}'
 rows.append('('+moves+','+state(v.apply(source,w['word']))+')')
definitions='\n'.join('def fixture%02d(): (List[Move], List[Sticker]) = '%i+row for i,row in enumerate(rows))
(HERE/'src/Fixtures.flix').write_text('/// Generated from the pinned Python oracle; see fixture-manifest.json.\ndef source(): List[Sticker] = '+state(source)+'\n\n'+definitions+'\n\ndef fixtures(): List[(List[Move], List[Sticker])] = List#{'+','.join('fixture%02d()'%i for i in range(100))+'}\n')
(HERE/'fixture-manifest.json').write_text(json.dumps({'baselineMain':'377747515be034cf19f656244a20449421b12b1d','input':'public/counter-proof.json','inputSHA256':hashlib.sha256(raw).hexdigest(),'oracle':'research/counter/verify.py','oracleSHA256':hashlib.sha256((ROOT/'research/counter/verify.py').read_bytes()).hexdigest(),'canonicalFullStates':100,'stickersPerState':24,'typedAdapterLimitation':'Python decodes raw JSON and move tokens. Flix validates typed legal-move geometry and full expected frames, not the complete raw witness schema.'},indent=2)+'\n')
