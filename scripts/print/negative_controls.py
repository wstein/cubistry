"""Independent reviewer-authored corrupt-export controls; portable path adaptation only."""
import io,json,hashlib,subprocess,tempfile,shutil,sys
from pathlib import Path
import xml.etree.ElementTree as ET
from pypdf import PdfReader,PdfWriter
from pypdf.generic import NameObject,BooleanObject,FloatObject
ROOT=Path(__file__).resolve().parents[2];CHECK=Path(__file__).with_name('verify_exports.py')
SOURCE=ROOT/'public/print/de-a-16mm-2sets'
base=Path(tempfile.mkdtemp(prefix='cubistry-print-negative-'));shutil.copytree(SOURCE,base/'positive')
def run(folder):return subprocess.run([sys.executable,str(CHECK),str(ROOT),str(folder)],capture_output=True,text=True)
positive=run(base/'positive');assert positive.returncode==0,positive.stdout+positive.stderr

def mutate(kind,folder,m):
 if kind=='duplicate physical identity':m['stickers'][1]['id']=m['stickers'][0]['id']
 elif kind=='wrong face normal':m['stickers'][0]['normal']=[0,-1,0]
 elif kind=='wrong glyph rotation':m['stickers'][0]['rotationDeg']=(m['stickers'][0]['rotationDeg']+90)%360
 elif kind=='mirrored SVG glyph':
  p=folder/'artwork-1.svg';s=p.read_text();s=s.replace('scale(', 'scale(-',1);p.write_text(s)
 elif kind=='open cut contour':
  p=folder/'cuts-1.svg';s=p.read_text();s=s.replace('Z"','"',1);p.write_text(s)
 elif kind in ('PDF overprint disabled','wrong PDF cut spot','wrong PDF cut geometry'):
  p=folder/'print.pdf';r=PdfReader(io.BytesIO(p.read_bytes()));w=PdfWriter();w.clone_document_from_reader(r);page=w.pages[0]
  if kind=='PDF overprint disabled':
   for gs in page['/Resources']['/ExtGState'].values():gs.get_object()[NameObject('/OP')]=BooleanObject(False)
  elif kind=='wrong PDF cut spot':
   cs=page['/Resources']['/ColorSpace'];value=cs[NameObject('/kiss_cut')];value[1]=NameObject('/wrong_cut')
  else:
   stream=page.get_contents();ops=stream.operations;active=False
   for args,op in ops:
    if op==b'CS' and str(args[0])=='/kiss_cut':active=True
    if active and op==b'm':args[0]=FloatObject(float(args[0])+0.3);break
   stream.operations=ops;page.replace_contents(stream)
  with p.open('wb') as f:w.write(f)
 else:raise AssertionError(kind)
 for filename in m['files']:m['files'][filename]=hashlib.sha256((folder/filename).read_bytes()).hexdigest()
 (folder/'manifest.json').write_text(json.dumps(m))

results=[]
for index,kind in enumerate(['duplicate physical identity','wrong face normal','wrong glyph rotation','mirrored SVG glyph','open cut contour','PDF overprint disabled','wrong PDF cut spot','wrong PDF cut geometry']):
 folder=base/f'bad-{index}';shutil.copytree(base/'positive',folder);m=json.loads((folder/'manifest.json').read_text());mutate(kind,folder,m)
 result=run(folder);assert result.returncode!=0,kind+' was accepted'
 lines=(result.stdout+result.stderr).splitlines();results.append({'control':kind,'rejected':True,'reason':lines[-1]})
print(json.dumps({'positiveControl':'PASS','rejectedControls':results},indent=2))
shutil.rmtree(base)
