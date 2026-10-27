"""Synthesize and independently certify split-century German wordmark designs."""
import collections,copy,csv,datetime as dt,json,sys
from pathlib import Path
from verify_german import ROTATIONS,rotate,piece_class,target_projections,verify_design_and_group,require
from verify_palette import independent_print_rotation
ROOT=Path(__file__).resolve().parents[1]
SOURCE=json.loads((ROOT/'results/german-zero-day-wordmark.json').read_text())
ART=['wordmark:left','wordmark:middle','wordmark:right']
PALETTE=dict(weekdayLetters='weekday-black',monthLetters='date-red',dateDigits='date-red',yearDigits='year-gray',timeDigits='time-blue',separator='wordmark-image-assets',colon='date-red')

def printed(s,slot,char):
    s=copy.deepcopy(s)
    target=(slot%5-2,2-slot//5,2)
    R=next(R for R in ROTATIONS if rotate(s['position'],R)==target and rotate(s['normal'],R)==(0,0,1))
    from verify_german import palette_ink
    s.update(symbol=char,up=[R[j][1] for j in range(3)],targetSlots=[slot],ink=palette_ink(PALETTE,slot,char))
    return s

def construct(hundreds):
    r={k:copy.deepcopy(SOURCE[k]) for k in ['language','dayPadding','hourPadding','separatorStyle','palette','glyphModel','row4Artwork','wordmark','design']}
    r.update(status='UNKNOWN',yearFields=dict(thousands=[' ','1','2'],hundreds=list(hundreds)),proof='docs/SPLIT_CENTURY.md',yearLayout='thousands,hundreds,blank,tens,units',calendar='proleptic Gregorian; years 1–2999 filtered by yearFields, year zero excluded')
    design=r['design']['stickers']
    for s in design:
        if piece_class(s['position'])=='fixedCenters':s.update(symbol=' ',ink='none',targetSlots=[])
    # Each middledge role gets its own group of physical cubies. Symbols
    # sharing a two-sticker piece belong to the same mutually exclusive role.
    groups={}
    for s in design:
        if piece_class(s['position'])=='middleEdges':groups.setdefault(tuple(s['position']),[]).append(s)
    pieces=list(groups.values());i=0;packing=[]
    for slot,chars in [(2,'NEMT'),(10,' 12'),(14,'0123456789'),(22,':')]:
        for j in range(0,len(chars),2):
            tokens=chars[j:j+2].ljust(2,chars[j])
            p=[]
            for s,c in zip(pieces[i],tokens):design[s['id']]=printed(s,slot,c);p.append(dict(symbol=c,slots=[slot]))
            packing.append(p);i+=1
    require(i==10,'Ten disjoint middle-edge role cubies')
    for pair in pieces[i:]:
        p=[]
        for s in pair:
            s.update(symbol=' ',ink='none',targetSlots=[]);p.append(dict(symbol=' ',slots=[]))
        packing.append(p)
    r['design']['packings']['middleEdges']={'pieces':packing,'construction':'ten disjoint role groups; two cubies unallocated'}
    # Preserve the exact three image-sticker frames, rebuild other axial print.
    axial=[s for s in design if piece_class(s['position'])=='axialCenters' and s['symbol']!='wordmark:middle']
    tokens=[(7,c) for c in 'AD FJMNOS'.replace(' ','')]+[(11,c) for c in hundreds]+[(13,c) for c in '0123456789']
    require(len(tokens)<=len(axial),'Axial printing budget')
    for s in axial:s.update(symbol=' ',ink='none',targetSlots=[])
    for s,(slot,c) in zip(axial,tokens):design[s['id']]=printed(s,slot,c)
    patterns=target_projections('zero','zero','three',ART,year_fields=r['yearFields'])
    for k,t in patterns.items():r['design']['packings'][k]['projectedTargets']=len(t)
    years=[y for y in range(1,3000) if str(y//100%10) in hundreds]
    r.update(supportedYearCount=len(years),validDates=sum((dt.date(y+1,1,1)-dt.date(y,1,1)).days for y in years))
    r['totalDisplays']=r['validDates']*1440
    r['capacity']=dict(axialUsed=19+len(hundreds),axialTotal=24,middleEdgeRoleCubies=10,middleEdgeTotal=12,blankAxialPositions=5-len(hundreds),unusedMiddleEdgeCubies=2,globallyMaximizedReserves=False)
    return r

def csv_text(r):
    import io
    stream=io.StringIO();w=csv.writer(stream,lineterminator='\n')
    w.writerow(['id','face','row','col','image_or_glyph','ink','print_rotation_ccw_degrees','planned_front_slots'])
    for s in r['design']['stickers']:
        w.writerow([s['id'],['U','D','F','B','R','L'][s['id']//25],s['id']%25//5+1,s['id']%5+1,'BLANK' if s['symbol']==' ' else s['symbol'],s['ink'],independent_print_rotation(s),'|'.join(f'{i//5+1}:{i%5+1}' for i in s['targetSlots'])])
    return stream.getvalue()

def main():
    verify='--verify' in sys.argv
    # Minimum requested, all requested, and the two alternative fifth digits.
    for i,h in enumerate(['09','098','0987','09876','09871']):
        r=construct(h)
        require(r['palette']==PALETTE and r['row4Artwork']==ART,'Colors and ordered full-image targets unchanged')
        certificate=verify_design_and_group(r,reuse_group=i>0)
        upright=copy.deepcopy(r);upright['matchingQuarterTurns']={c:([0,1,2,3] if c==' ' else [0]) for c in r['glyphModel']['quarterTurns']}
        verify_design_and_group(upright,reuse_group=True)
        if h=='0987':
            for kind in ['missing gray century 9','rotated middle logo']:
                bad=copy.deepcopy(r)
                if kind=='missing gray century 9':
                    for sticker in bad['design']['stickers']:
                        if sticker['targetSlots']==[11] and sticker['symbol']=='9':sticker.update(symbol=' ',ink='none')
                else:
                    sticker=next(s for s in bad['design']['stickers'] if s['symbol']=='wordmark:middle')
                    n,u=sticker['normal'],sticker['up']
                    sticker['up']=[n[1]*u[2]-n[2]*u[1],n[2]*u[0]-n[0]*u[2],n[0]*u[1]-n[1]*u[0]]
                try:verify_design_and_group(bad,reuse_group=True)
                except AssertionError as e:require('matching' in str(e),'Control must fail actual target matching')
                else:raise AssertionError('Incorrect printing accepted: '+kind)
        r.update(status='SAT',reachabilityCertificate=certificate,allNonfixedPrintedGlyphsUpright=True)
        path=ROOT/'results'/f'german-century-{h}.json';plan=path.with_name(path.stem+'-printing.csv')
        if verify:
            require(json.loads(path.read_text())==r,'Saved split-century certificate differs')
            require(plan.read_text()==csv_text(r),'Saved printing CSV differs')
        else:
            path.write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n');plan.write_text(csv_text(r))
        print(f'VERIFIED split-century H={h}: SAT, {r["supportedYearCount"]} years, {r["validDates"]} dates, axial {19+len(h)}/24; all thousand signs blank/1/2 share ONE printing.',flush=True)
    verify_six_class_bound(verify)

def verify_six_class_bound(verify=False):
    # Recompute identity/ink multiplicities from all actual-calendar projections,
    # rather than assuming the 19+H formula. Rotations cannot reduce simultaneous
    # demand for two distinct physical stickers carrying an identical image.
    from verify_german import palette_ink
    fields=dict(thousands=[' ','1','2'],hundreds=list('098761'))
    patterns=target_projections('zero','zero','three',ART,year_fields=fields)['axialCenters']
    maxima=collections.Counter()
    witnesses={}
    for target in sorted(patterns):
        hist=collections.Counter((char,palette_ink(PALETTE,slot,char)) for slot,char in target)
        for key,n in hist.items():
            if n>maxima[key]:maxima[key]=n;witnesses[key]=target
    available=sum(piece_class(s['position'])=='axialCenters' for s in SOURCE['design']['stickers'])
    require(sum(maxima.values())==25 and available==24,'Actual immutable-identity inventory must contradict physical capacity')
    bound=dict(status='UNSAT',yearFields=fields,yearLayout='thousands,hundreds,blank,tens,units',palette=PALETTE,availableAxialStickers=available,requiredAxialStickers=sum(maxima.values()),checkedAxialProjections=len(patterns),
               requiredIdentityMultiplicities=[dict(symbol=c,ink=ink,count=n,witnessTarget=witnesses[(c,ink)]) for (c,ink),n in sorted(maxima.items())],
               scope='six full hundreds classes; all ten decades; immutable glyph/image identities, fixed inks and split-year positions; rotation symmetries unrestricted')
    path=ROOT/'results/german-century-six-bound.json'
    if verify:require(json.loads(path.read_text())==json.loads(json.dumps(bound)),'Saved counting bound differs')
    else:path.write_text(json.dumps(bound,ensure_ascii=False,indent=2)+'\n')
    print('VERIFIED six full hundreds classes UNSAT: actual calendar requires 25 immutable axial sticker images, only 24 exist, regardless of rotation symmetries.')
if __name__=='__main__':main()
