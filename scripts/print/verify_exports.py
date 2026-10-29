"""Independent physical frame, vector cut and PDF graphics-state checks."""
import json,hashlib,math,re,sys
from pathlib import Path
import xml.etree.ElementTree as ET
from collections import Counter
from fontTools.pens.boundsPen import BoundsPen
from fontTools.svgLib.path import parse_path
from pypdf import PdfReader

ROOT=Path(sys.argv[1]); OUT=Path(sys.argv[2]); M=json.loads((OUT/'manifest.json').read_bytes())
need=lambda ok,message: None if ok else (_ for _ in ()).throw(AssertionError(message))
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
need(sha(ROOT/M['source']['path'])==M['source']['sha256'],'exact source hash')
raw=json.loads((ROOT/M['source']['path']).read_bytes()); src={s['id']:s for s in raw['printing']}
N=3 if len(src)==54 else 2
need(len(src)==6*N*N==M.get('stickersPerCube',len(src)),'physical source count')
need(len(M['stickers'])==M['copies']*len(src),'all source stickers for each copy')
need(Counter(s['id'] for s in M['stickers'])==Counter({i:M['copies'] for i in src}),'no missing or duplicated physical identity')
F={'U':((0,1,0),(0,0,-1)),'D':((0,-1,0),(0,0,1)),'L':((-1,0,0),(0,1,0)),'R':((1,0,0),(0,1,0)),'F':((0,0,1),(0,1,0)),'B':((0,0,-1),(0,1,0))}
dot=lambda a,b:sum(x*y for x,y in zip(a,b))
def cross(a,b): return(a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])
rec={s['uid']:s for s in M['stickers']};need(len(rec)==len(M['stickers']),'unique sheet IDs')
for r in rec.values():
 s=src[r['id']];normal,up=F[r['face']];right=cross(up,normal)
 need(tuple(s['n'])==normal==tuple(r['normal']),'correct physical face normal')
 need(s['p']==r['sourcePosition'] and s['up']==r['sourceUp'] and s['image']==r['image'] and s['cubie']==r['cubie'],'exact source payload')
 need(r['row']==round((1-dot(s['p'],up))*(N-1)/2) and r['column']==round((1+dot(s['p'],right))*(N-1)/2),'outward-view face row and column')
 angle=math.degrees(math.atan2(dot(s['up'],right),dot(s['up'],up)))%360
 need(abs(angle-r['rotationDeg'])<1e-8,'exact upright source direction')
 rad=math.radians(angle); restored=tuple(round(math.sin(rad)*right[i]+math.cos(rad)*up[i]) for i in range(3))
 need(restored==tuple(s['up']),'rotated art up reconstructs physical up')
 restored_right=tuple(round(math.cos(rad)*right[i]-math.sin(rad)*up[i]) for i in range(3))
 need(restored_right==cross(s['up'],s['n']),'orientation has no reflection')
 x,y,d,b=(r[k] for k in ('xMm','yMm','sizeMm','bleedMm'))
 need(0<=x-b and x+d+b<=210 and 0<=y-b and y+d+b<=297,'bleed fits A4')
for name,h in M['files'].items():need(sha(OUT/name)==h,'output byte hash '+name)
for name,h in M['artInputs'].items():need(sha(ROOT/name)==h,'original artwork input hash '+name)
for r in rec.values():
 for entry,param in [('sizeMm','sizeMm'),('cornerRadiusMm','cornerRadiusMm'),('bleedMm','bleedMm'),('safeMm','safeMm')]:need(r[entry]==M['parameters'][param],'declared physical parameters match every sticker')
need((OUT/'ARTWORK-LICENSE.txt').read_bytes()==(ROOT/'LICENSE').read_bytes(),'project artwork license retained')
if M['design']=='hsm-symbols':need(M['font'] is None,'geometric symbol artwork is not falsely attributed to a font')
else:need((OUT/'OFL.txt').read_bytes()==(ROOT/'public/fonts/OFL.txt').read_bytes(),'source font license retained')

ns={'s':'http://www.w3.org/2000/svg'}
seen=[]; safe_paths=0
for page in range(1,M['pages']+1):
 svg=ET.parse(OUT/f'artwork-{page}.svg').getroot()
 need(svg.attrib['width']=='210mm' and svg.attrib['height']=='297mm' and svg.attrib['viewBox']=='0 0 210 297','SVG physical millimeters')
 for e in svg.iter():need(e.tag.rsplit('}',1)[-1] not in ('image','text','foreignObject') and not any('href' in k for k in e.attrib),'self-contained vector artwork')
 for group in svg.findall('s:g',ns):
  r=rec[group.attrib['id']];need(r['page']==page,'sheet page mapping');seen.append(r['uid'])
  inner=group.find('s:g',ns); t=inner.attrib['transform'];a=list(map(float,re.findall(r'-?\d+(?:\.\d+)?',t)))
  x,y,d=r['xMm'],r['yMm'],r['sizeMm'];need(len(a)==6,'unambiguous art transform')
  cx,cy,angle,scale,tx,ty=a
  need(abs(cx-(x+d/2))<1e-5 and abs(cy-(y+d/2))<1e-5 and angle==r['rotationDeg'] and tx==ty==-128 and scale>0,'actual SVG physical orientation transform')
  need(abs(scale-d/256*r['artScale'])<1e-6,'actual SVG scale')
  for path in inner.findall('s:path',ns):
   bp=BoundsPen(None);parse_path(path.attrib['d'],bp)
   if not bp.bounds:continue
   l,t0,rr,bb=bp.bounds
   if path.attrib.get('stroke','none')!='none':
    w=float(path.attrib.get('stroke-width','1'))/2
    if path.attrib.get('stroke-linecap')=='square':w*=math.sqrt(2)
    l-=w;t0-=w;rr+=w;bb+=w
   for u in (l,rr):
    for v in (t0,bb):
     th=math.radians(angle);du,dv=(u-128)*scale,(v-128)*scale
     px,py=d/2+math.cos(th)*du-math.sin(th)*dv,d/2+math.sin(th)*du+math.cos(th)*dv
     inset=r['safeMm'];rad=max(0,r['cornerRadiusMm']-inset);q1=abs(px-d/2)-(d/2-inset-rad);q2=abs(py-d/2)-(d/2-inset-rad)
     sdf=math.hypot(max(q1,0),max(q2,0))+min(max(q1,q2),0)-rad
     need(sdf<=3e-5,'actual vector ink bounds inside rounded safe cut inset')
   safe_paths+=1
need(set(seen)==set(rec) and len(seen)==len(rec),'all artwork source UIDs')

pdf=PdfReader(OUT/'print.pdf');need(len(pdf.pages)==M['pages'],'PDF page count')
for page in pdf.pages:
 need(abs(float(page.mediabox.width)-210*72/25.4)<1e-3 and abs(float(page.mediabox.height)-297*72/25.4)<1e-3,'PDF A4 physical size')
 need(not list(page.images),'PDF artwork is not rasterized')
 color=page['/Resources']['/ColorSpace']['/kiss_cut'].get_object()
 need(color[:3]==['/Separation','/kiss_cut','/DeviceCMYK'],'real named process-independent cut spot')
 need(any(getattr(v.get_object().get('/OP'),'value',False) is True for v in page['/Resources']['/ExtGState'].values()),'actual stroke overprint resource')
summary={'status':'PASS','design':M['design'],'sourceStickers':len(src),'copies':M['copies'],'physicalStickersChecked':len(rec),'safeVectorPathsChecked':safe_paths,'pages':len(pdf.pages)}

from fontTools.pens.recordingPen import RecordingPen

def path_commands(path):
 pen=RecordingPen();parse_path(path,pen);out=[];current=start=None
 for op,points in pen.value:
  if op=='endPath': continue
  if op=='qCurveTo':
   need(len(points)==2 and points[1] is not None,'explicit SVG quadratic segment')
   c,e=points
   out.append(('c',[current[i]+2*(c[i]-current[i])/3 for i in range(2)]+[e[i]+2*(c[i]-e[i])/3 for i in range(2)]+list(e)))
   current=e
  else:
   name={'moveTo':'m','lineTo':'l','curveTo':'c','closePath':'h','endPath':'h'}[op]
   out.append((name,[v for pt in points for v in pt]))
   if points:current=points[-1]
   if op=='moveTo':start=current
   if op=='closePath':current=start
 return out

def rounded(x,y,s,r):
 k=0.5522847498307936*r
 return [('m',[x+r,y]),('l',[x+s-r,y]),('c',[x+s-r+k,y,x+s,y+r-k,x+s,y+r]),('l',[x+s,y+s-r]),('c',[x+s,y+s-r+k,x+s-r+k,y+s,x+s-r,y+s]),('l',[x+r,y+s]),('c',[x+r-k,y+s,x,y+s-r+k,x,y+s-r]),('l',[x,y+r]),('c',[x,y+r-k,x+r-k,y,x+r,y]),('h',[])]

def same_path(a,b,tol=0.001):
 return len(a)==len(b) and all(aa==bb and len(ap)==len(bp) and all(abs(float(x)-float(y))<tol for x,y in zip(ap,bp)) for (aa,ap),(bb,bp) in zip(a,b))

def mul(m,n):
 a,b,c,d,e,f=m;A,B,C,D,E,F=n
 return [a*A+c*B,b*A+d*B,a*C+c*D,b*C+d*D,a*E+c*F+e,b*E+d*F+f]

def transformed(commands,m):
 a,b,c,d,e,f=m;out=[]
 for op,coords in commands:
  values=[]
  for x,y in zip(coords[::2],coords[1::2]):values.extend([a*float(x)+c*float(y)+e,b*float(x)+d*float(y)+f])
  out.append((op,values))
 return out

PPM=72/25.4; PDF_H=297*PPM
checked_cuts=checked_shapes=0
for page_index,page in enumerate(pdf.pages,1):
 page_rec=[r for r in M['stickers'] if r['page']==page_index]
 expected_matrices={}
 svg=ET.parse(OUT/f'artwork-{page_index}.svg').getroot()
 svg_shapes={g.attrib['id']:[path_commands(p.attrib['d']) for p in g.findall('s:g/s:path',ns)] for g in svg.findall('s:g',ns)}
 for r in page_rec:
  th=math.radians(r['rotationDeg']);co,si=math.cos(th),math.sin(th);k=r['sizeMm']/256*r['artScale'];cx=r['xMm']+r['sizeMm']/2;cy=r['yMm']+r['sizeMm']/2
  expected_matrices[r['uid']]=[PPM*k*co,-PPM*k*si,-PPM*k*si,-PPM*k*co,PPM*(cx-128*k*co+128*k*si),PDF_H-PPM*(cy-128*k*si-128*k*co)]
 cut_svg=ET.parse(OUT/f'cuts-{page_index}.svg').getroot()
 cut_paths=cut_svg.findall('.//s:path',ns)
 need(len(cut_paths)==len(page_rec),'exact count of actual SVG cut contours')
 need({p.attrib['id'].removeprefix('cut-') for p in cut_paths}=={r['uid'] for r in page_rec},'actual SVG cuts cover exact physical sheet IDs')
 for path in cut_paths:
  r=rec[path.attrib['id'].removeprefix('cut-')]
  need(same_path(path_commands(path.attrib['d']),rounded(r['xMm'],r['yMm'],r['sizeMm'],r['cornerRadiusMm'])),'actual SVG cubic quarter-circle cut geometry')
 stack=[];state={'m':[1,0,0,1,0,0],'cs':None,'tint':None,'op':False};path=[];cut_index=0;art_seen=Counter()
 for operands,operator in page.get_contents().operations:
  op=operator.decode();v=[float(x) if isinstance(x,(int,float)) else x for x in operands]
  if op=='q':stack.append({**state,'m':state['m'][:]})
  elif op=='Q':state=stack.pop()
  elif op=='cm':state['m']=mul(state['m'],list(map(float,operands)))
  elif op=='CS':state['cs']=str(operands[0])
  elif op=='SCN':state['tint']=float(operands[0])
  elif op=='RG':state['cs']='DeviceRGB'
  elif op=='gs':
   gs=page['/Resources']['/ExtGState'][operands[0]].get_object()
   if '/OP' in gs:state['op']=gs['/OP'].value
  elif op=='n':path=[]
  elif op in ('m','l','c','h'):path.append((op,list(map(float,operands))))
  elif op=='re':path.append(('re',list(map(float,operands))))
  elif op in ('S','s','f','f*','B','B*','b','b*'):
   if state['cs']=='/kiss_cut' and op in ('S','s','B','B*','b','b*'):
    need(state['op'] is True and state['tint']==1,'cut spot active and overprinted')
    need(cut_index<len(page_rec),'no extra cut contours')
    r=page_rec[cut_index];cut_index+=1
    # Native PDF points become the SVG's top-left millimeter coordinates.
    to_mm=[1/PPM,0,0,-1/PPM,0,297]
    actual=transformed(path,mul(to_mm,state['m']))
    need(same_path(actual,rounded(r['xMm'],r['yMm'],r['sizeMm'],r['cornerRadiusMm'])),'actual PDF cubic cut matches independent physical path')
    checked_cuts+=1
   elif path and all(p[0]!='re' for p in path):
    matches=[uid for uid,m in expected_matrices.items() if all(abs(x-y)<0.001 for x,y in zip(m,state['m']))]
    need(len(matches)==1,'every production PDF glyph is placed in one exact source frame')
    uid=matches[0];i=art_seen[uid];art_seen[uid]+=1
    
    need(i<len(svg_shapes[uid]) and same_path(path,svg_shapes[uid][i]),'actual PDF outlined glyph path matches corresponding SVG path')
    checked_shapes+=1
   path=[]
  elif op in ('Tj','TJ',"'",'"'):
   need(False,'production PDF contains live text instead of outlined glyphs')
 need(cut_index==len(page_rec),'exact count of PDF cut contours')
 need(all(art_seen[uid]==len(paths) for uid,paths in svg_shapes.items()),'all vector glyphs present in actual PDF')
summary.update({'pdfSvgCutContoursVerified':checked_cuts,'actualPDFSVGOutlinedPathsVerified':checked_shapes})


# Independent exact Rodrigues replay; no generator or application mechanics imports.
def rotate(vector,axis,quarters):
 e=tuple(int(i==axis) for i in range(3));c=(1,0,-1,0)[quarters%4];s=(0,1,0,-1)[quarters%4]
 perpendicular=cross(e,vector);parallel=dot(e,vector)
 return tuple(vector[i]*c+perpendicular[i]*s+e[i]*parallel*(1-c) for i in range(3))
def replay_word(state,word):
 layers={'R':(0,1),'L':(0,-1),'U':(1,1),'D':(1,-1),'F':(2,1),'B':(2,-1),'x':(0,None),'y':(1,None),'z':(2,None)}
 for t in word.split():
  need(re.fullmatch(r"[RLUDFBxyz](2|')?",t),'legal setup notation')
  axis,layer=layers[t[0]];amount=2 if t.endswith('2') else -1 if t.endswith("'") else 1
  q=(-amount if layer is None else -layer*amount)%4
  state=tuple((i,b,rotate(p,axis,q),rotate(n,axis,q),rotate(u,axis,q),im) if layer is None or p[axis]==layer else (i,b,p,n,u,im) for i,b,p,n,u,im in state)
 return state
def invert(word):return ' '.join(t if t.endswith('2') else t[:-1] if t.endswith("'") else t+"'" for t in word.split()[::-1])
state=tuple((s['id'],s['cubie'],tuple(s['p']),tuple(s['n']),tuple(s['up']),s['image']) for s in src.values())
setup_count=0
for key,word in M.get('setupExamples',{}).items():
 end=replay_word(state,word)
 ys=(1,0,-1) if N==3 else (1,-1);xs=(-1,0,1) if N==3 else(-1,1)
 observed=[next(s for s in end if s[2]==(x,y,1) and s[3]==(0,0,1)) for y in ys for x in xs]
 if N==3:
  import datetime
  date=datetime.date.fromisoformat(key);digits=list(f'{date.day:02d}')
  if M['design']=='de-a':expected=[*('MO','DI','MI','DO','FR','SA','SO')[date.weekday()],'','',*digits,*('JAN','FEB','MÄR','APR','MAI','JUN','JUL','AUG','SEP','OKT','NOV','DEZ')[date.month-1]]
  else:expected=[('MON','TUE','WED','THU','FRI','SAT','SUN')[date.weekday()],'','',*('JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC')[date.month-1],'',*digits]
 else:expected=['',key,'0','0']
 need([s[5] for s in observed]==expected,'actual physical setup labels')
 need(all(not s[5] or s[4]==(0,1,0) for s in observed),'setup printed glyphs upright')
 need(replay_word(end,invert(word))==state,'full inverse restores all source identity frames')
 setup_count+=1
summary.update({'setupExamplesIndependentlyReplayed':setup_count,'allInverseFramesRestored':True})
print(json.dumps(summary,indent=2))
