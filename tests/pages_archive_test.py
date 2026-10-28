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
 def test_valid_implicit_head_gets_noindex(self):
  p=self.archive([('index.html','<!doctype html><html><meta charset="utf-8"><body>valid implicit head</body></html>')]);E.extract(p,self.root/'implicit',52,'a'*40)
  self.assertIn('noindex,nofollow',(self.root/'implicit/index.html').read_text())
 def test_reject_traversal_links_special_names_and_duplicate_paths(self):
  for name in ['../outside','/root','a/../x','a//x','a\\x','C:x','.git/config','pr-preview/pr-1/index.html','a/%2e/x']:
   with self.subTest(name=name),self.assertRaises(ValueError):E.extract(self.archive([('index.html','<html><body>site</body></html>'),(name,'x')]),self.root/'bad')
  p=self.archive([('index.html','<html><body>site</body></html>')]);info=zipfile.ZipInfo('link');info.external_attr=(stat.S_IFLNK|0o777)<<16
  with zipfile.ZipFile(p,'a') as z:z.writestr(info,'../outside')
  with self.assertRaises(ValueError):E.extract(p,self.root/'bad')
 def test_reject_missing_root_and_budget(self):
  with self.assertRaises(ValueError):E.extract(self.archive([('assets/a','x')]),self.root/'bad')
  with self.assertRaises(ValueError):E.extract(self.archive([('index.html','<html><body>site</body></html>'),('large',b'a'*(16*1024*1024+1))]),self.root/'large')
 def test_snapshot_preserves_production_and_both_previews(self):
  site=self.root/'site';(site/'pr-preview/pr-1').mkdir(parents=True);(site/'pr-preview/pr-2').mkdir();(site/'index.html').write_text('PRODUCTION');(site/'pr-preview/pr-1/index.html').write_text('A');(site/'pr-preview/pr-2/index.html').write_text('B')
  S.snapshot(site,self.root/'snapshot');self.assertEqual((self.root/'snapshot/index.html').read_text(),'PRODUCTION');self.assertEqual((self.root/'snapshot/pr-preview/pr-2/index.html').read_text(),'B')
  shutil.rmtree(site/'pr-preview/pr-1');S.snapshot(site,self.root/'updated');self.assertFalse((self.root/'updated/pr-preview/pr-1').exists());self.assertTrue((self.root/'updated/pr-preview/pr-2/index.html').exists())
 def test_preview_marker_ignores_comments_scripts_and_inert_fragments(self):
  from html.parser import HTMLParser
  class Visible(HTMLParser):
   def __init__(self):super().__init__();self.asides=0;self.metas=0
   def handle_starttag(self,tag,attrs):
    self.asides+=tag=='aside';self.metas+=tag=='meta' and ('name','robots') in attrs
  for prefix in ['<!-- <head><body> -->', '<script>const example="<head><body>";</script>', '<title>literal <head><body> title</title>', '<textarea>literal <head><body> text</textarea>', '<template><head><body></body></head></template>', '<noscript><head><body></body></head></noscript>']:
   document='<html><head>'+prefix+'</head><body>app</body></html>'
   marked=E.mark_preview(document,52,'a'*40)
   self.assertIn('</head><body><aside ',marked)
   self.assertIn('<head><meta name="robots" content="noindex,nofollow">',marked)
   self.assertIn(prefix,marked)
  with self.assertRaises(ValueError):E.mark_preview('<html><head><template><body>inert only</body></template></head></html>',52,'a'*40)
 def test_reject_ambiguous_document_containers(self):
  for document in ['<html><head><template/></head><body>inert</body></html>', '<html><head><noscript/></head><body>ambiguous</body></html>', '<html><head></head><body>one<body>two</body></html>', '<html><head></head><head></head><body>duplicate</body></html>']:
   with self.subTest(document=document),self.assertRaises(ValueError):E.mark_preview(document,52,'a'*40)
 def test_reject_directory_or_empty_root_index(self):
  for items in [[('index.html/','')],[('index.html','')],[('index.html','not an HTML document')]]:
   with self.subTest(items=items),self.assertRaises(ValueError):E.extract(self.archive(items),self.root/'invalid-index')
 def test_never_publish_previews_only(self):
  site=self.root/'empty';site.mkdir()
  with self.assertRaises(ValueError):S.snapshot(site,self.root/'bad')
