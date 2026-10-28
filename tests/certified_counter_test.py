"""Negative controls for the independent actual-commit replay."""
import importlib.util,json,shutil,tempfile,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('certified',ROOT/'research/certified-counter/verify.py')
V=importlib.util.module_from_spec(spec);spec.loader.exec_module(V)
class CertifiedControls(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.root=Path(self.tmp.name)
        shutil.copytree(ROOT/'research/certified-counter',self.root/'research/certified-counter')
        (self.root/'public').mkdir();shutil.copy(ROOT/'public/counter-certified.v1.json',self.root/'public')
        self.trace=self.root/'commits.json';shutil.copy(ROOT/'test-results/certified-commits.json',self.trace)
        self.original=(V.ROOT,V.HERE);V.ROOT=self.root;V.HERE=self.root/'research/certified-counter'
    def tearDown(self):V.ROOT,V.HERE=self.original;self.tmp.cleanup()
    def test_valid_actual_commits(self):self.assertEqual(V.check(self.trace)['actualCommittedHTM'],339)
    def test_runtime_edge_tamper(self):
        p=self.root/'public/counter-certified.v1.json';d=json.loads(p.read_text());d['increments'][0]='R';p.write_text(json.dumps(d))
        with self.assertRaises(AssertionError):V.check(self.trace)
    def test_research_evidence_tamper(self):
        p=V.HERE/'evidence/optimized.json';p.write_text(p.read_text()+' ')
        with self.assertRaises(AssertionError):V.check(self.trace)
    def test_actual_commit_omitted(self):
        d=json.loads(self.trace.read_text());d['transitions'][0]['word']='';self.trace.write_text(json.dumps(d))
        with self.assertRaises(AssertionError):V.check(self.trace)
    def test_hidden_state_tamper(self):
        d=json.loads(self.trace.read_text());d['transitions'][0]['state']['cubies'][0]['orientation']=[[1,0,0],[0,1,0],[0,0,1]];self.trace.write_text(json.dumps(d))
        with self.assertRaises(AssertionError):V.check(self.trace)
