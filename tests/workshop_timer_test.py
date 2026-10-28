"""Independent Timer replay and corruption controls."""
import importlib.util,json,shutil,tempfile,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('workshop',ROOT/'research/workshop-timer/verify.py');V=importlib.util.module_from_spec(spec);spec.loader.exec_module(V)
class TimerControls(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.root=Path(self.tmp.name);shutil.copytree(ROOT/'research/workshop-timer',self.root/'research/workshop-timer');(self.root/'public').mkdir();shutil.copy(ROOT/'public/workshop-timer.v1.json',self.root/'public');self.trace=self.root/'trace.json';shutil.copy(ROOT/'test-results/workshop-timer-commits.json',self.trace);self.old=(V.ROOT,V.HERE);V.ROOT=self.root;V.HERE=self.root/'research/workshop-timer'
 def tearDown(self):V.ROOT,V.HERE=self.old;self.tmp.cleanup()
 def test_actual_fifteen_minutes(self):self.assertEqual(V.check(self.trace)['actualHTM'],331)
 def test_runtime_tamper(self):
  p=self.root/'public/workshop-timer.v1.json';d=json.loads(p.read_text());d['increments'][0]='R';p.write_text(json.dumps(d))
  with self.assertRaises(AssertionError):V.check()
 def test_evidence_tamper(self):
  p=V.HERE/'evidence/optimization/optimized.json';p.write_text(p.read_text()+' ')
  with self.assertRaises(AssertionError):V.check()
 def test_missing_actual_move(self):
  d=json.loads(self.trace.read_text());d['transitions'][0]['word']='';self.trace.write_text(json.dumps(d))
  with self.assertRaises(AssertionError):V.check(self.trace)
 def test_hidden_actual_pose(self):
  d=json.loads(self.trace.read_text());d['transitions'][0]['state']['cubies'][0]['position']=[1,1,1];self.trace.write_text(json.dumps(d))
  with self.assertRaises(AssertionError):V.check(self.trace)

 def test_duplicate_or_reordered_countdown(self):
  for values in ([89]*89+[0],list(range(88,-1,-1))+[0]):
   d=json.loads(self.trace.read_text())
   for t,value in zip(d['transitions'],values):t['value']=value
   self.trace.write_text(json.dumps(d))
   with self.assertRaises(AssertionError):V.check(self.trace)

 def test_missing_countdown_display(self):
  d=json.loads(self.trace.read_text());d['transitions'].pop();self.trace.write_text(json.dumps(d))
  with self.assertRaises(AssertionError):V.check(self.trace)

 def test_explicit_trace_kind_required(self):
  d=json.loads(self.trace.read_text());d.pop('kind');self.trace.write_text(json.dumps(d))
  with self.assertRaises(AssertionError):V.check(self.trace)
