"""Independent certificate corruption controls; no generator/JS imports."""
import importlib.util,json,tempfile,unittest
from pathlib import Path
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('five_verify',HERE/'verify.py');V=importlib.util.module_from_spec(spec);spec.loader.exec_module(V)
class CertificateControls(unittest.TestCase):
    @classmethod
    def setUpClass(cls):cls.original=json.loads((HERE/'certificate.json').read_text())
    def reject(self,edit):
        candidate=json.loads(json.dumps(self.original));edit(candidate)
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder)/'bad.json';path.write_text(json.dumps(candidate))
            with self.assertRaises((AssertionError,KeyError,ValueError)):V.check(path,shortest=False)
    def test_full_replay_and_maximum(self):
        result=V.check(HERE/'certificate.json');self.assertEqual((result['inclusiveStates'],result['adjacentEdges'],result['totalHTM'],result['maximumHTM']),(480,479,2261,6));self.assertTrue(result['maximumRangeProven'])
    def test_wrong_printed_digit(self):self.reject(lambda d:d['printing'][0].update(image='9'))
    def test_wrong_upright_frame(self):self.reject(lambda d:d['printing'][0].update(up=[-v for v in d['printing'][0]['up']]))
    def test_missing_edge(self):self.reject(lambda d:d['increments'].pop())
    def test_illegal_move(self):self.reject(lambda d:d['increments'].__setitem__(0,d['increments'][0]+' X'))
    def test_corrupt_accounting(self):self.reject(lambda d:d.update(totalHTM=d['totalHTM']+1))
    def test_colliding_cubies(self):self.reject(lambda d:d['printing'][3].update(cubie=0))
    def test_boolean_identity(self):self.reject(lambda d:d['printing'][0].update(id=False))
    def test_unsupported_top(self):self.reject(lambda d:d.update(maxSeconds=2400))
    def test_structural_upper_bound(self):
        p=V.U.audit_upper_bound();self.assertEqual((p['status'],p['firstExcludedSeconds'],p['copyPlacementsChecked'],len(p['oldCartesianSurvivors'])),('UNSAT',2400,12,2))
if __name__=='__main__':unittest.main()
