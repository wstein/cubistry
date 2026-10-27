import importlib.util,json,tempfile,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('live_replay',ROOT/'research/m1-acceptance/verify_live_solver.py');checker=importlib.util.module_from_spec(spec);spec.loader.exec_module(checker)
class LiveSolverReplayTests(unittest.TestCase):
    def test_saved_solver_results_preserve_all_physical_frames(self):self.assertEqual(checker.verify(ROOT/'research/m1-acceptance/live-solver-output.json')['exactInverseRestorations'],5)
    def test_tampered_solver_path_is_rejected(self):
        data=json.loads((ROOT/'research/m1-acceptance/live-solver-output.json').read_text());data['cases'][0]['word']='R'
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'bad.json';path.write_text(json.dumps(data))
            with self.assertRaises(AssertionError):checker.verify(path)
if __name__=='__main__':unittest.main()
