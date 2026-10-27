import importlib.util,json,tempfile,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('design_checker',ROOT/'research/architecture/verify_design.py');checker=importlib.util.module_from_spec(spec);spec.loader.exec_module(checker)
class DesignWireTests(unittest.TestCase):
    def reject(self,mutate):
        d=json.loads((ROOT/'public/counter-design.v2.json').read_text());mutate(d)
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'bad.json';path.write_text(json.dumps(d))
            with self.assertRaises(AssertionError):checker.verify(path)
    def test_wrong_version(self):self.reject(lambda d:d.update(version=999))
    def test_wrong_puzzle(self):self.reject(lambda d:d.update(puzzle='5x5x5'))
    def test_wrong_topology(self):self.reject(lambda d:d['prints']['padded']['topology'].update(size=5))
    def test_unresolved_image(self):self.reject(lambda d:d['prints']['padded']['stickers'][0].update(assetId='missing'))
    def test_external_asset_url(self):self.reject(lambda d:d['assets']['fonts'][0].update(url='https://evil.test/f.woff2'))
    def test_boolean_cubie_reference(self):self.reject(lambda d:d['prints']['padded']['stickers'][0].update(cubie=False))
    def test_boolean_sticker_id(self):self.reject(lambda d:d['prints']['padded']['stickers'][0].update(id=False))
    def test_boolean_cubie_id(self):self.reject(lambda d:d['prints']['padded']['cubies'][0].update(id=False))
    def test_integral_numeric_literals_match_javascript(self):
        d=json.loads((ROOT/'public/counter-design.v2.json').read_text());d['prints']['padded']['stickers'][0]['cubie']=0.0
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'valid.json';path.write_text(json.dumps(d));self.assertEqual(checker.verify(path)['status'],'PASS')
if __name__=='__main__':unittest.main()
