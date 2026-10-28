"""Replay actual viewer/controller commits with the independent Rodrigues checker."""
import json,sys
from pathlib import Path
import physical_replay as P
HERE=Path(__file__).resolve().parent

def wire(printing,state):
    cubies={c['id']:c for c in state['cubies']}
    def rot(v,r):return tuple(sum(v[j]*r[j][i] for j in range(3)) for i in range(3))
    return tuple((s['id'],s['cubie'],tuple(cubies[s['cubie']]['position']),rot(s['normal'],cubies[s['cubie']]['orientation']),rot(s['up'],cubies[s['cubie']]['orientation']),s['assetId']) for s in printing['stickers'])

def check(path):
    d=json.loads((HERE/'optimized-runtime.json').read_text());trace=json.loads(Path(path).read_text())
    source=tuple((s['id'],s['cubie'],tuple(s['p']),tuple(s['n']),tuple(s['up']),s['image']) for s in d['printing'])
    states=[];state=source
    for word in [d['zeroWord']]+d['increments']:state=P.apply(state,word);states.append(state)
    total=0;edges=0
    if 'observations' in trace:
        batches=[{'print':trace['print'],'start':trace['start'],'startValue':trace['tickFrom'],'transitions':[{'value':trace['tickFrom']+1,'word':trace['word'],'state':o['moves'][-1]['to'],'moves':o['moves']}]} for o in trace['observations']]
    else:batches=[trace]
    for batch in batches:
        state=wire(batch['print'],batch['start']);P.need(state==states[batch['startValue']],'Canonical start mismatch')
        for t in batch['transitions']:
            old=state;state=P.apply(state,t['word']);value=t['value'];P.need(type(value) is int and 0<=value<480,'Invalid target')
            P.show(state,value*5);P.need(state==states[value]==wire(batch['print'],t['state']),'Actual full-state mismatch')
            if 'moves' in t:
                intermediate=old;tokens=[]
                for m in t['moves']:
                    move=m['move'];token=move['face']+('2' if move['turns']==2 else "'" if move['turns']==-1 else '');tokens.append(token)
                    intermediate=P.apply(intermediate,token);P.need(intermediate==wire(batch['print'],m['to']),'Actual per-move commit mismatch')
                P.need(' '.join(tokens)==t['word'],'Trace move list differs from word')
            total+=len(t['word'].split());edges+=1
    return dict(status='PASS',actualTransitions=edges,actualHTM=total,batches=len(batches))
if __name__=='__main__':print(json.dumps(check(sys.argv[1]),indent=2))
