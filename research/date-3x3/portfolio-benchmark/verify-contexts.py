"""Independent physical replay of same-source historical counterfactual probes."""
import json,sys
from pathlib import Path
from hashlib import sha256
import verify as V
p=Path(sys.argv[1]);raw=p.read_bytes();data=json.loads(raw)
V.need(data['schema']=='cubistry.calendar-portfolio-fixture-probes','Exact fixture probe schema')
fixture_bytes=Path(__file__).with_name('investigation').joinpath('portfolio-contexts.json').read_bytes()
V.need(sha256(fixture_bytes).hexdigest()==data['fixtureSHA256']=='c8fd5d9601f931b8896db54709b729fff22599936c8a3d1f8ef57289fe568812','Pinned source-context fixture bytes')
V.need(data['fixture']==json.loads(fixture_bytes),'Exact original source-context witness')
fixture=data['fixture'];V.need(len(data['rows'])==len(fixture['contexts'])==18,'All18 recorded contexts')
sources={}
for identity,(witness,model,printing_hash)in V.SOURCES.items():
 w=json.loads((V.ROOT/witness).read_text());m=json.loads((V.ROOT/model).read_text())
 sources[identity]=V.W.source_state(w['printing'],m)
 V.need(fixture['printingSHA256'][identity]==printing_hash,'Pinned source printing')
replays=0
for index,row in enumerate(data['rows']):
 f=row['fixture'];V.need(f==fixture['contexts'][index],'Exact ordered historical source context')
 source=V.replay(sources[f['id']],f['sourceWord']);V.W.show(source,V.cells(f['id'],'2026-11-03'))
 V.W.show(V.replay(source,f['directWord']),V.cells(f['id'],'2026-11-04'))
 a,b=row['baseline'],row['portfolio'];attempts=b['attempts']
 V.need(1<=len(attempts)<=2 and b['maximumTotalNodes']==200000 and b['maximumAttempts']==2,'Explicit portfolio ceiling')
 V.need(attempts[0]['word']==a['word'],'Same-source first attempt equals frozen default result')
 V.need(len(b['word'].split())<=len(a['word'].split()),'Portfolio retains old checked best at identical source')
 for word in [a['word'],b['word'],*[attempt['word']for attempt in attempts if 'word'in attempt]]:
  end=V.replay(source,word);V.W.show(end,V.cells(f['id'],'2026-11-04'))
  V.need(V.replay(end,V.W.inverse(word))==source,'Full54 inverse and hidden-frame legality')
  replays+=1
 for n,a in enumerate(attempts):
  if'word'not in a:V.need(a.get('status')=='error'and not a.get('attempted'),'Explicit structural error');continue
  c=V.counts(a['word']);V.need((c['total'],c['htm'],c['global'])==(a['moves'],a['outerHTM'],a['rotations']),'Candidate physical counts')
  depth=a['maximumDepth']
  V.need(a['maximumNodes']==100000 and type(depth) is int and 0<=depth<=(24 if n==0 else 18),'Explicit typed nonnegative per-attempt depth bounds')
 V.need(V.counts(b['word'])['htm']<=f['expectedMoves'],'Recorded fixture regression threshold')
print(json.dumps({'status':'PASS','captureSHA256':sha256(raw).hexdigest(),'contexts':18,'all54CandidateReplaysAndInverses':replays,'sameSourceDefaultRetained':18,'optimality':'UNKNOWN','universalMoveBound':'UNKNOWN'},indent=2))
