import importlib.util,io,json,os,shutil,stat,tempfile,unittest,zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def load(name,file):
 s=importlib.util.spec_from_file_location(name,ROOT/'scripts/pages'/file);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
E=load('extract','extract.py');S=load('snapshot','snapshot.py')
class StaticArchiveTests(unittest.TestCase):
 def setUp(self):self.tmp=tempfile.TemporaryDirectory();self.root=Path(self.tmp.name)
 def tearDown(self):self.tmp.cleanup()
 def archive(self,items):
  p=self.root/'site.zip'
  with zipfile.ZipFile(p,'w') as z:
   for name,data in items:z.writestr(name,data)
  return p
 def test_noindex_and_preview_banner(self):
  p=self.archive([('index.html','<html><head></head><body>site</body></html>'),('assets/a.js','safe static text')]);E.extract(p,self.root/'out',52,'a'*40)
  text=(self.root/'out/index.html').read_text();self.assertIn('noindex,nofollow',text);self.assertIn('PR #52',text);self.assertEqual((self.root/'out/assets/a.js').read_text(),'safe static text')
 def test_reject_traversal_links_special_names_and_duplicate_paths(self):
  for name in ['../outside','/root','a/../x','a//x','a\\x','C:x','.git/config','pr-preview/pr-1/index.html','a/%2e/x']:
   with self.subTest(name=name),self.assertRaises(ValueError):E.extract(self.archive([('index.html','x'),(name,'x')]),self.root/'bad')
  p=self.archive([('index.html','x')]);info=zipfile.ZipInfo('link');info.external_attr=(stat.S_IFLNK|0o777)<<16
  with zipfile.ZipFile(p,'a') as z:z.writestr(info,'../outside')
  with self.assertRaises(ValueError):E.extract(p,self.root/'bad')
 def test_reject_missing_root_and_budget(self):
  with self.assertRaises(ValueError):E.extract(self.archive([('assets/a','x')]),self.root/'bad')
  with self.assertRaises(ValueError):E.extract(self.archive([('index.html','x'),('large',b'a'*(16*1024*1024+1))]),self.root/'large')
 def test_snapshot_preserves_production_and_both_previews(self):
  site=self.root/'site';(site/'pr-preview/pr-1').mkdir(parents=True);(site/'pr-preview/pr-2').mkdir();(site/'index.html').write_text('PRODUCTION');(site/'pr-preview/pr-1/index.html').write_text('A');(site/'pr-preview/pr-2/index.html').write_text('B')
  S.snapshot(site,self.root/'snapshot');self.assertEqual((self.root/'snapshot/index.html').read_text(),'PRODUCTION');self.assertEqual((self.root/'snapshot/pr-preview/pr-2/index.html').read_text(),'B')
  shutil.rmtree(site/'pr-preview/pr-1');S.snapshot(site,self.root/'updated');self.assertFalse((self.root/'updated/pr-preview/pr-1').exists());self.assertTrue((self.root/'updated/pr-preview/pr-2/index.html').exists())
 def test_never_publish_previews_only(self):
  site=self.root/'empty';site.mkdir()
  with self.assertRaises(ValueError):S.snapshot(site,self.root/'bad')
