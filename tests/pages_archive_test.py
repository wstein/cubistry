import importlib.util,io,json,os,re,shutil,stat,subprocess,sys,tempfile,unittest,zipfile
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
  text=(self.root/'out/index.html').read_text();self.assertIn('noindex,nofollow',text);self.assertIn('Cubistry PR preview · <a href="https://github.com/wstein/cubistry/pull/52" target="_blank" rel="noopener noreferrer">PR #52</a> — non-production preview · '+('a'*12),text);self.assertEqual((self.root/'out/assets/a.js').read_text(),'safe static text')
 def banner(self,title,number=52):
  text=E.mark_preview('<html><head></head><body>x</body></html>',number,'a'*40,title)
  return re.search(r'<aside[^>]*>(.*)</aside>',text).group(1)
 def test_banner_link_is_built_from_the_validated_number_only(self):
  self.assertIn('<a href="https://github.com/wstein/cubistry/pull/7" target="_blank" rel="noopener noreferrer">PR #7</a>',self.banner('t',7))
  for bad in (0,-1,'x','1"><script>'):
   with self.subTest(bad=bad),self.assertRaises(ValueError):E.mark_preview('<html><head></head><body>x</body></html>',bad,'a'*40,'t')
 def test_banner_title_is_escaped_single_line_and_bounded(self):
  b=self.banner('<script>alert(1)</script> "q" \'s\' & more')
  self.assertNotIn('<script>',b);self.assertIn('&lt;script&gt;alert(1)&lt;/script&gt; &quot;q&quot; &#x27;s&#x27; &amp; more',b)
  b=self.banner('a\nb\r\n\tc\x00d\u2028e\u202ef  g');self.assertIn(' · a b c d ef g — non-production',b)
  b=self.banner('x'*500);m=re.search(r'</a> · (x+)\u2026 —',b);self.assertTrue(m);self.assertEqual(len(m.group(1))+1,80)
  self.assertIn('Zürich 日本語 🚀 fix',self.banner('Zürich 日本語 🚀 fix'))
 def test_banner_title_cap_boundaries_and_escape_after_truncation(self):
  def title(b):return re.search(r'</a> · (.*) — non-production',b).group(1)
  self.assertEqual(title(self.banner('a'*80)),'a'*80)
  self.assertEqual(title(self.banner('a'*81)),'a'*79+'\u2026')
  self.assertEqual(title(self.banner('a'*79+'&')),'a'*79+'&amp;')
  self.assertEqual(title(self.banner('a'*78+'&&&')),'a'*78+'&amp;\u2026')
  self.assertEqual(title(self.banner('a'*80+'<')),'a'*79+'\u2026')
 def test_cname_is_rejected_in_previews_but_not_production(self):
  for name in ('CNAME','sub/CNAME','a/b/CNAME'):
   with self.subTest(name=name),self.assertRaises(ValueError):E.extract(self.archive([('index.html','<html><body>site</body></html>'),(name,'x.example')]),self.root/('p'+name.replace('/','_')),52,'a'*40)
  E.extract(self.archive([('index.html','<html><body>site</body></html>'),('CNAME','x.example')]),self.root/'prod')
  self.assertEqual((self.root/'prod/CNAME').read_text(),'x.example')
 def test_banner_omits_missing_or_blank_titles(self):
  for title in ('',None,'  \n\t ','\u200b'):
   with self.subTest(title=title):self.assertIn('</a> — non-production preview',self.banner(title))
 def test_cli_passes_title_as_one_argument(self):
  p=self.archive([('index.html','<html><head></head><body>site</body></html>')]);title='$(touch pwned) `x` ; "q" <b>'
  subprocess.run([sys.executable,'-I',str(ROOT/'scripts/pages/extract.py'),str(p),str(self.root/'cli'),'9','a'*40,title],check=True)
  text=(self.root/'cli/index.html').read_text();self.assertIn('$(touch pwned) `x` ; &quot;q&quot; &lt;b&gt;',text);self.assertFalse(Path('pwned').exists())
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
  for prefix in ['<!-- <head><body> -->', '<script>const example="<head><body>";</script>', '<title>literal <head><body> title</title>', '<template><head><body></body></head></template>', '<noscript><head><body></body></head></noscript>']:
   document='<html><head>'+prefix+'</head><body>app</body></html>'
   marked=E.mark_preview(document,52,'a'*40)
   self.assertIn('</head><body><aside ',marked)
   self.assertIn('<head><meta name="robots" content="noindex,nofollow">',marked)
   self.assertIn(prefix,marked)
  marked=E.mark_preview('<html><head></head><body><textarea>literal <head><body> text</textarea></body></html>',52,'a'*40)
  self.assertIn('</head><body><aside ',marked)
  with self.assertRaises(ValueError):E.mark_preview('<html><head><template><body>inert only</body></template></head></html>',52,'a'*40)
 def test_reject_ambiguous_document_containers(self):
  for document in ['<html><head><template/></head><body>inert</body></html>', '<html><head><script/>const sample="<body>";</script></head><div>app</div></html>', '<html><head></head><iframe><body>fallback</iframe><div>app</div></html>', '<html><head><noscript/></head><body>ambiguous</body></html>', '<html><head></head><body>one<body>two</body></html>', '<html><head></head><head></head><body>duplicate</body></html>']:
   with self.subTest(document=document),self.assertRaises(ValueError):E.mark_preview(document,52,'a'*40)
 def test_reject_directory_or_empty_root_index(self):
  for items in [[('index.html/','')],[('index.html','')],[('index.html','not an HTML document')]]:
   with self.subTest(items=items),self.assertRaises(ValueError):E.extract(self.archive(items),self.root/'invalid-index')
 def test_never_publish_previews_only(self):
  site=self.root/'empty';site.mkdir()
  with self.assertRaises(ValueError):S.snapshot(site,self.root/'bad')
