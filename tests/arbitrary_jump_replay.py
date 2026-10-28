"""Independent replay of all eight fixed-frame issue44 fixtures, raw and selected."""
import importlib.util,json,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('independent',ROOT/'research/certified-counter/verify.py');V=importlib.util.module_from_spec(spec);spec.loader.exec_module(V)
def verify():
    cases=json.loads((ROOT/'tests/fixtures/arbitrary-jumps.json').read_text())
    for c in cases:
        start=V.state_from_wire(c['print'],c['from']);goal=V.state_from_wire(c['print'],c['target'])
        word=' '.join(m['face']+('2' if m['turns']==2 else "'" if m['turns']==-1 else '') for m in c['selected'])
        assert V.P.apply(start,word)==goal
        assert V.P.apply(start,' '.join(c['raw']['moves']))==goal
        assert V.P.apply(goal,V.P.inverse(word))==start
        V.P.show(start,c['a'],True);V.P.show(goal,c['b'],True)
    print('PASS: eight raw/selected physical endpoints, 24 sticker identities and frames; no free regrips')
if __name__=='__main__':
    verify()
    if len(sys.argv)>1:
        cases=json.loads((ROOT/'tests/fixtures/arbitrary-jumps.json').read_text())
        actual=json.loads(Path(sys.argv[1]).read_text());assert len(actual)==len(cases)
        for c,a in zip(cases,actual):
            start=V.state_from_wire(c['print'],a['from']);target=V.state_from_wire(c['print'],a['to'])
            assert start==V.state_from_wire(c['print'],c['from'])
            assert target==V.state_from_wire(c['print'],c['target'])
            word=' '.join(m['face']+('2' if m['turns']==2 else "'" if m['turns']==-1 else '') for m in a['moves'])
            assert V.P.apply(start,word)==target
            assert len(a['moves'])==len(c['selected'])
        print('PASS: actual browser preview/commits and all physical fixture frames')

