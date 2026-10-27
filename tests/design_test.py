import importlib.util,json,tempfile,unittest,shutil,hashlib
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
    def test_pure_asset_metadata_profile(self):
        cases=[lambda a:a['documents'][0].update(text=['BREAK','MINUTES']),lambda a:a['materials'][0].update(color='not-a-color'),lambda a:a['documents'][0].update(text='x\n'*16),lambda a:a['documents'][0].update(background='red'),lambda a:a['documents'][0].update(fontId=0),lambda a:a['documents'][0].update(minFontSize=1000),lambda a:a['fonts'][0].update(family='<script>'),lambda a:a['fonts'][0].update(license=False),lambda a:a['fonts'][0].update(weight=True)]
        for index,mutate in enumerate(cases):
            with self.subTest(case=index):self.reject(lambda d:mutate(d['assets']))
    def test_svg_css_escape_reference_rejected_independently(self):
        original_root=checker.ROOT
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);shutil.copytree(ROOT/'public',root/'public')
            d=json.loads((root/'public/counter-design.v2.json').read_text());asset=next(a for a in d['assets']['images'] if a['kind']=='image')
            path=root/'public'/asset['url'][1:];text=path.read_text().replace('fill="', 'fill="u'+chr(92)+'72l('+chr(92)+'68ttps'+chr(92)+'3a//example.invalid/paint) ',1);path.write_text(text);asset['sha256']=hashlib.sha256(path.read_bytes()).hexdigest()
            wire=root/'bad.json';wire.write_text(json.dumps(d));checker.ROOT=root
            try:
                with self.assertRaisesRegex(AssertionError,'Unsafe SVG attribute'):checker.verify(wire)
            finally:checker.ROOT=original_root
    def test_configurable_title_linkage(self):
        def solid(d):
            for i,image in enumerate(d['assets']['images']):
                if image['id'] in ('title-left','title-right'):d['assets']['images'][i]=dict(id=image['id'],kind='color',color='#ffffff')
        def other_document(d):
            d['assets']['documents'].append(dict(d['assets']['documents'][0],id='other-title'))
            next(i for i in d['assets']['images'] if i['id']=='title-left')['documentId']='other-title'
        def wrong_crop(d):next(i for i in d['assets']['images'] if i['id']=='title-right')['crop']=[0,0,256,256]
        for mutation in (solid,other_document,wrong_crop):
            with self.subTest(mutation=mutation.__name__):self.reject(mutation)
    def test_integral_numeric_literals_match_javascript(self):
        d=json.loads((ROOT/'public/counter-design.v2.json').read_text());d['prints']['padded']['stickers'][0]['cubie']=0.0
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'valid.json';path.write_text(json.dumps(d));self.assertEqual(checker.verify(path)['status'],'PASS')
if __name__=='__main__':unittest.main()
