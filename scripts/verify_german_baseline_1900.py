"""Freeze an existing printing; check only the exact German 1900–2099 baseline.

No synthesis and no additional century experiment. Target generation below is
independent of the ReScript generator and prior broad-range Python enumerator.
The reused group engine recomputes the exact physical theorem in this process.
"""
import collections,contextlib,copy,csv,datetime as dt,hashlib,itertools,json,platform,resource,sys,time
from pathlib import Path
import verify_german as group
ROOT=Path(__file__).resolve().parents[1]
WITNESS=ROOT/'results/german-century-09.json'
PLAN=ROOT/'results/german-century-09-printing.csv'
SLOTS={'corners':(0,4,20,24),'middleEdges':(2,10,14,22),'wings':(1,9,15,23,3,5,19,21),'axialCenters':(7,11,13,17),'diagonalCenters':(6,8,16,18)}
ART=['wordmark:left','wordmark:middle','wordmark:right']
PALETTE=dict(weekdayLetters='weekday-black',monthLetters='date-red',dateDigits='date-red',yearDigits='year-gray',timeDigits='time-blue',separator='wordmark-image-assets',colon='date-red')

def require(ok,message):
    if not ok:raise AssertionError(message)

def targets():
    weekdays='MON DIE MIT DON FRE SAM SON'.split();months='JAN FEB MÄR APR MAI JUN JUL AUG SEP OKT NOV DEZ'.split()
    dates={k:set() for k in SLOTS};times={k:set() for k in SLOTS};day=dt.date(1900,1,1);count=0;boundaries={}
    wanted={'1900-01-01','1900-02-28','1900-03-01','1999-12-31','2000-01-01','2000-02-29','2000-03-01','2099-12-31'}
    while day<dt.date(2100,1,1):
        y=str(day.year);cells=list(weekdays[day.weekday()]+'  '+f'{day.day:02}'+months[day.month-1]+y[:2]+' '+y[2:])+[' ',*ART,' ']
        require(len(cells)==20 and cells[12]==cells[15]==cells[19]==' ','Fixed-center and outer logo blanks')
        for k,slots in SLOTS.items():dates[k].add(tuple(cells[i] for i in slots if i<20))
        if day.isoformat() in wanted:boundaries[day.isoformat()]=cells
        count+=1;day+=dt.timedelta(days=1)
    for minute in range(1440):
        text=f'{minute//60:02}:{minute%60:02}'
        for k,slots in SLOTS.items():times[k].add(tuple(text[i-20] for i in slots if i>=20))
    patterns={}
    for k,slots in SLOTS.items():
        patterns[k]=[]
        for d,t in itertools.product(sorted(dates[k]),sorted(times[k])):
            di,ti=iter(d),iter(t);patterns[k].append(tuple((i,next(di) if i<20 else next(ti)) for i in slots))
    require(count==73049 and set(boundaries)==wanted,'Exact date domain and leap-day boundaries')
    try:dt.date(1900,2,29)
    except ValueError:pass
    else:raise AssertionError('1900 is not a Gregorian leap year')
    return patterns,count,boundaries

def check_csv(r):
    def cross(a,b):return(a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])
    with PLAN.open(newline='') as f:rows=list(csv.DictReader(f))
    require(len(rows)==150,'All physical sticker IDs need source printing instructions')
    for row,s in zip(rows,r['design']['stickers']):
        up=[(0,0,-1),(0,0,1),(0,1,0),(0,1,0),(0,1,0),(0,1,0)][s['id']//25];left=cross(s['normal'],up)
        choices=[up,left,tuple(-v for v in up),tuple(-v for v in left)];angle=choices.index(tuple(s['up']))*90
        expected=dict(id=str(s['id']),face=['U','D','F','B','R','L'][s['id']//25],row=str(s['id']%25//5+1),col=str(s['id']%5+1),image_or_glyph='BLANK' if s['symbol']==' ' else s['symbol'],ink=s['ink'],print_rotation_ccw_degrees=str(angle),planned_front_slots='|'.join(f'{i//5+1}:{i%5+1}' for i in s['targetSlots']))
        require(row==expected,'Print CSV must match immutable physical images, inks, and frames')

def verify():
    start=time.monotonic();raw=WITNESS.read_bytes();r=json.loads(raw)
    require(r['language']=='DE' and r['dayPadding']==r['hourPadding']=='zero' and r['separatorStyle']=='three','Existing witness format must match baseline')
    require(r['palette']==PALETTE and r['row4Artwork']==ART,'Exact original colors and image order')
    require(r['yearFields']==dict(thousands=[' ','1','2'],hundreds=['0','9']),'Use the 21/24 two-hundreds print; not a 24/24 alternative')
    require(group.SLOTS==SLOTS,'Geometry engine front slots must match independently enumerated targets')
    check_csv(r)
    patterns,count,boundaries=targets();scoped=copy.deepcopy(r)
    for k,p in patterns.items():scoped['design']['packings'][k]['projectedTargets']=len(p)
    # Only counts in a private copy change. Every one of the 150 physical
    # stickers remains bit-for-bit identical to the frozen source printing.
    require(scoped['design']['stickers']==r['design']['stickers'],'A baseline review may not alter printing')
    upright=copy.deepcopy(scoped);upright['matchingQuarterTurns']={c:([0,1,2,3] if c==' ' else [0]) for c in scoped['glyphModel']['quarterTurns']}
    with contextlib.redirect_stdout(sys.stderr):
        certificate=group.verify_design_and_group(upright,target_patterns=patterns)
    controls={}
    for kind in ['blue date zero','rotated middle logo','nonblank fixed center']:
        bad=copy.deepcopy(upright)
        if kind=='blue date zero':
            for s in bad['design']['stickers']:
                if s['symbol']=='0' and s['ink']=='date-red':s['ink']='time-blue'
        elif kind=='rotated middle logo':
            s=next(s for s in bad['design']['stickers'] if s['symbol']==ART[1]);n,u=s['normal'],s['up'];s['up']=[n[1]*u[2]-n[2]*u[1],n[2]*u[0]-n[0]*u[2],n[0]*u[1]-n[1]*u[0]]
        else:
            s=next(s for s in bad['design']['stickers'] if s['position']==[0,0,2] and s['normal']==[0,0,1]);s.update(symbol='0',ink='year-gray')
        try:
            with contextlib.redirect_stdout(sys.stderr):group.verify_design_and_group(bad,reuse_group=True,target_patterns=patterns)
        except AssertionError as e:
            require(('matching' in str(e)) if kind!='nonblank fixed center' else str(e)=='Front fixed center printing','Control must fail the actual physical predicate')
            controls[kind]=dict(rejected=True,reason=str(e))
        else:raise AssertionError('Incorrect physical printing accepted: '+kind)
    require(WITNESS.read_bytes()==raw,'Original evidence was modified during review')
    return dict(status='SAT',issue=5,language='DE',years=[1900,2099],calendar='proleptic Gregorian',yearLayout='thousands,hundreds,blank,tens,units',dayPadding='zero',hourPadding='zero',sourceWitness='results/german-century-09.json',sourcePrintPlan='results/german-century-09-printing.csv',sourceWitnessSHA256=hashlib.sha256(raw).hexdigest(),sourcePrintPlanSHA256=hashlib.sha256(PLAN.read_bytes()).hexdigest(),checkerSHA256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),validDates=count,totalDisplays=count*1440,oneImmutablePrintingForEntireInterval=True,physicalPrintingModified=False,allNonfixedPrintedGlyphsUpright=True,artworkScope='three fixed distinct upright full-image tokens, including all internal colors; production artwork pixels not validated',palette=PALETTE,boundaryDateCells=boundaries,negativeControls=controls,reachabilityCertificate=certificate,environment=dict(python=platform.python_version(),sympy=group.sympy.__version__,platform=platform.platform()),run=dict(elapsedSeconds=round(time.monotonic()-start,3),maxResidentKiB=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss))
if __name__=='__main__':print(json.dumps(verify(),ensure_ascii=False,indent=2))
