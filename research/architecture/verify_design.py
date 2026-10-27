"""Independent v2 ingress/asset integrity and physical replay checker.

The existing independent Python geometry replayer remains separate from the
TypeScript core/generator. This adapter checks exact wire tags and references,
then converts the new versioned source definition to the preserved v1 contract.
"""
import hashlib,importlib.util,json,re,sys,tempfile,xml.etree.ElementTree as ET
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('facelet_checker',ROOT/'research/counter/verify.py');checker=importlib.util.module_from_spec(spec);spec.loader.exec_module(checker)
def require(ok,msg):
    if not ok:raise AssertionError(msg)
def asset_path(value):
    require(isinstance(value,str) and re.fullmatch(r'/[A-Za-z0-9_/-]+\.(svg|png|webp|woff2)',value) is not None and '//' not in value,'Unsafe asset path')
    path=(ROOT/'public'/value[1:]).resolve();require(path.is_relative_to((ROOT/'public').resolve()),'Asset escapes public root');return path
def integral(value):return checker.integral(value)
def identifier(value):return isinstance(value,str) and re.fullmatch(r'[A-Za-z0-9_-]{1,96}',value) is not None
def verify(path):
    raw=Path(path).read_bytes();require(len(raw)<=2097152,'Oversized design');d=json.loads(raw)
    require(d.get('schema')=='cubistry.counter-design' and integral(d.get('version')) and d['version']==2 and d.get('puzzle')=='2x2x2','Unsupported design schema/version/puzzle')
    original=(ROOT/'public/counter-proof.json').read_bytes();require(d.get('legacyWitnessSHA256')==hashlib.sha256(original).hexdigest(),'Incorrect original witness provenance')
    assets=d['assets'];require(assets.get('schema')=='cubistry.assets' and integral(assets.get('version')) and assets['version']==1,'Unsupported asset version')
    byid={a['id']:a for a in assets['images']};materials={a['id']:a for a in assets['materials']};fonts={a['id']:a for a in assets['fonts']};docs={a['id']:a for a in assets['documents']}
    for items in [assets['images'],assets['materials'],assets['fonts'],assets['documents']]:require(all(identifier(x['id']) for x in items),'Asset IDs must be strings')
    for key,index in [('images',byid),('materials',materials),('fonts',fonts),('documents',docs)]:require(len(assets[key])==len(index)<=64,'Duplicate/excess asset IDs')
    total=0
    for item in [*assets['fonts'],*[a for a in assets['images'] if a['kind']=='image']]:
        data=asset_path(item['url']).read_bytes();total+=len(data);require(len(data)<=262144 and total<=4194304,'Excess asset bytes');require(hashlib.sha256(data).hexdigest()==item['sha256'],'Asset integrity mismatch')
        if item.get('format')=='svg':
            text=data.decode();require(not re.search(r'<!|<\?|\b(script|foreignObject)\b',text,re.I),'Unsafe SVG')
            tree=ET.fromstring(text);tags={'svg','g','path','rect','circle','ellipse','line','polygon','polyline'};attrs={'viewBox','width','height','fill','stroke','stroke-width','stroke-linecap','stroke-linejoin','opacity','fill-opacity','stroke-opacity','d','x','y','x1','x2','y1','y2','cx','cy','r','rx','ry','points','transform'}
            require(tree.tag=='{http://www.w3.org/2000/svg}svg','Invalid SVG namespace/root')
            for element in tree.iter():
                require(element.tag.startswith('{http://www.w3.org/2000/svg}') and element.tag.split('}')[-1] in tags,'Unsafe SVG node')
                for k,v in element.attrib.items():require(k in attrs and not re.search(r'url\s*\(|javascript:|data:|https?:|@',v,re.I),'Unsafe SVG attribute')
            require(0<int(tree.attrib['width'])<=1024 and 0<int(tree.attrib['height'])<=1024,'Unbounded SVG dimensions')
        else:require(item.get('format')=='woff2' and data[:4]==b'wOF2','Unsupported source asset for this frozen proof')
    for font in assets['fonts']:require(integral(font.get('weight')) and 100<=font['weight']<=900,'Invalid font weight type')
    for mat in assets['materials']:require(type(mat.get('roughness')) in (int,float) and 0<=mat['roughness']<=1,'Invalid material numeric type')
    for doc in assets['documents']:
        require(all(integral(doc.get(k)) and 0<doc[k]<=1024 for k in ('width','height','fontSize','minFontSize','lineHeight')),'Invalid text integer dimensions')
        require(identifier(doc['fontId']) and doc['fontId'] in fonts and len(doc['text'])<=512,'Unknown font or excessive text')
    for asset in assets['images']:
        require(asset['kind'] in ('text','color','image'),'Unsupported asset kind')
        if asset['kind']=='text':
            require(identifier(asset['documentId']) and asset['documentId'] in docs,'Unknown text document');require(isinstance(asset['crop'],list) and len(asset['crop'])==4 and all(integral(v) for v in asset['crop']),'Invalid crop integer types');x,y,w,h=asset['crop'];doc=docs[asset['documentId']];require(x>=0 and y>=0 and w>0 and h>0 and x+w<=doc['width'] and y+h<=doc['height'],'Invalid text crop')
    def convert(printing):
        require(printing.get('schema')=='cubistry.print' and integral(printing.get('version')) and printing['version']==1 and printing.get('topology')=={'kind':'cube','size':2},'Unsupported print or topology')
        require(all(integral(c.get('id')) for c in printing['cubies']),'Cubie IDs must be integers, not booleans');positions={c['id']:c['position'] for c in printing['cubies']};require(sorted(positions)==list(range(8)) and len(printing['cubies'])==8,'Eight distinct source cubies')
        out=[]
        for s in printing['stickers']:
            require(integral(s.get('id')) and integral(s.get('cubie')),'Sticker/cubie references must be integers, not booleans')
            require(all(integral(v) for v in s['equivalentQuarterTurns']),'Invalid quarter-turn integer types')
            require(identifier(s['assetId']) and identifier(s['materialId']) and s['assetId'] in byid and s['materialId'] in materials,'Unresolved sticker reference');image=' ' if s['assetId']=='blank' else s['assetId'];require(image in ['title-left','title-right',' ',*list('0123456789')],'Unsupported counter semantic image')
            require(s['equivalentQuarterTurns']==([0,1,2,3] if image==' ' else [0]),'Invalid counter optical convention')
            out.append(dict(id=s['id'],cubie=s['cubie'],p=positions[s['cubie']],n=s['normal'],up=s['up'],image=image))
        return sorted(out,key=lambda s:s['id'])
    canonical=json.loads(original);padded=convert(d['prints']['padded']);unpadded=convert(d['prints']['unpadded']);
    require(padded==[{k:s[k] for k in ('id','cubie','p','n','up','image')} for s in canonical['printing']] and unpadded==[{k:s[k] for k in ('id','cubie','p','n','up','image')} for s in canonical['unpaddedPrinting']],'Physical printing differs from the preserved evidence')
    require(all(integral(w.get('value')) and isinstance(w.get('word'),str) for w in d['witnesses']),'Invalid witness wire types')
    require(d['witnesses']==canonical['witnesses'],'Move witness changed without new evidence')
    legacy=dict(schema=1,puzzle='2x2x2',printing=padded,unpaddedPrinting=unpadded,witnesses=d['witnesses'])
    with tempfile.TemporaryDirectory() as directory:
        temp=Path(directory)/'legacy.json';temp.write_text(json.dumps(legacy));physical=checker.check(temp)
    return dict(status='PASS',schema=d['schema'],version=2,puzzle='2x2x2',designSHA256=hashlib.sha256(raw).hexdigest(),checkerSHA256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),legacyWitnessPreserved=True,immutableImageReferencesChecked=True,assetBytes=total,physical=physical)
if __name__=='__main__':print(json.dumps(verify(sys.argv[1] if len(sys.argv)>1 else ROOT/'public/counter-design.v2.json'),indent=2))
