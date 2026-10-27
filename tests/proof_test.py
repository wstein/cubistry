import importlib.util,json,tempfile,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('independent',ROOT/'research/counter/verify.py');checker=importlib.util.module_from_spec(spec);spec.loader.exec_module(checker)
class GeometryTests(unittest.TestCase):
    def reject(self,change):
        data=json.loads((ROOT/'public/counter-proof.json').read_text());change(data)
        with tempfile.TemporaryDirectory() as d:
            path=Path(d)/'bad.json';path.write_text(json.dumps(data))
            with self.assertRaises(AssertionError):checker.check(path)
    def test_nonaxis_normal(self):self.reject(lambda d:d['printing'][0].update(n=[2/3,2/3,-1/3]))
    def test_nonaxis_print_up(self):self.reject(lambda d:d['printing'][0].update(up=[0,0.6,0.8]))
    def test_two_cubies_share_position(self):
        def change(d):
            for s in d['printing']:
                if s['cubie']==1:s['p']=d['printing'][0]['p'][:]
        self.reject(change)
    def test_missing_facelet_identity(self):self.reject(lambda d:d['printing'].__setitem__(1,d['printing'][0].copy()))
    def test_silent_unpadded_repaint(self):self.reject(lambda d:d['unpaddedPrinting'][0].update(image='9'))
if __name__=='__main__':unittest.main()
