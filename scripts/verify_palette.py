"""Independent DE palette and rotation verification; no JS imports.

A fresh exact legal-group verification is mandatory in this Python process
before reusing its completion theorem for further fixed colored designs.
"""
import copy
import csv
import itertools
import json
from pathlib import Path
from verify_single import independent_requirements, require
from verify_german import (UNITS,ROTATIONS,rotate,dot,cross,piece_class,chirality,
                           palette_ink,verify_design_and_group)

ROOT=Path(__file__).resolve().parents[1]
FIELDS=['weekdayLetters','monthLetters','dateDigits','yearDigits','timeDigits','separator','colon']
FINE=dict(zip(FIELDS,['weekday-ink','month-ink','date-time-digit-ink','year-ink','date-time-digit-ink','separator-ink','colon-ink']))


def proper_pose_patterns():
    patterns={1:set(),-1:set()}
    for p in itertools.product(range(-2,3),repeat=3):
        if sorted(map(abs,p))!=[1,2,2]: continue
        for n in UNITS:
            if dot(p,n)!=2: continue
            sign=chirality(p,n)
            for up in UNITS:
                if dot(up,n): continue
                poses=[]
                for R in ROTATIONS:
                    if rotate(n,R)!=(0,0,1): continue
                    x,y,_=rotate(p,R)
                    q={(0,1,0):0,(-1,0,0):1,(0,-1,0):2,(1,0,0):3}[rotate(up,R)]
                    poses.append(((2-y)*5+x+2,q))
                patterns[sign].add(tuple(sorted(poses)))
    return patterns


POSES=proper_pose_patterns()
DATA=independent_requirements('DE')


def role_separation(palette,glyphs):
    # Every possible physical wing sticker and all four print-up directions
    # were enumerated above; each actual glyph/color can serve at most one
    # role-token in the corresponding sign orbit if this lemma holds.
    for side,sign in [('positive',1),('negative',-1)]:
        domain={(slot,char,palette_ink(palette,slot,char)) for slot,char in DATA['domains'][side]}
        for char,ink in {(c,i) for _,c,i in domain}:
            for pattern in POSES[sign]:
                served={(slot,c,i) for slot,q in pattern for _,c,i in domain
                        if c==char and i==ink and q in glyphs[c] and (slot,c,i) in domain}
                if len(served)>1: return False
    return True


def negative_certificate(palette,glyphs):
    require(role_separation(palette,glyphs),'Do not claim UNSAT: a sticker can serve more than one required role')
    require(DATA['missing']=={((9,'B'),(5,'3'))},'Calendar exception relation')
    a,b,n=map(int,(len(DATA['domains']['positive']),len(DATA['domains']['negative']),24))
    lower,upper=2*b-n,2*(n-a)+1
    require(lower>upper,'Counting lemma is not violated')
    return dict(positiveRequiredRoles=a,negativeRequiredRoles=b,minimumSingletonB=lower,
                maximumSupportableSingletonB=upper,minimumWingCubies=(2*(a+b)-1+2)//3,
                roleSeparationCheckedByAllProperRotations=True)


def partitions(n):
    def recurse(values):
        if len(values)==n:
            yield values
        else:
            for v in range(max(values,default=-1)+2):
                yield from recurse(values+[v])
    return list(recurse([]))


def original_palette(p):
    w,d,y,t=['ink-'+str(i) for i in p]
    return dict(weekdayLetters=w,monthLetters=d,dateDigits=d,yearDigits=y,timeDigits=t,separator=y,colon=d)


def independent_print_rotation(s):
    # Canonical up direction for U/D/F/B/R/L in the documented physical net.
    up=[(0,0,-1),(0,0,1),(0,1,0),(0,1,0),(0,1,0),(0,1,0)][s['id']//25]
    n=tuple(s['normal'])
    left=cross(n,up)
    options=[up,left,tuple(-v for v in up),tuple(-v for v in left)]
    return options.index(tuple(s['up']))*90


def verify_palettes(certify=False):
    path=ROOT/'results/palette-analysis.json'
    r=json.loads(path.read_text())
    base=json.loads((ROOT/'results/german-monochrome.json').read_text())
    require(base['status']=='SAT','The source is only a candidate, not a certified design')
    require(r['glyphModel']==base['glyphModel'],'No font change between palette cases')
    require(r['language']=='DE' and r['layout']=='unchanged','Palette scope')
    require(r['fieldNames']==FIELDS,'Field definitions')
    fine=r['mostSeparatedWitness']
    require(fine['palette']==FINE and fine['inkCount']==6 and fine['sourceDesign']=='german-monochrome.json','Maximally separated witness')
    require(len(fine['stickerInks'])==150,'Each sticker needs one immutable ink')
    physical=copy.deepcopy(base)
    physical['palette']=FINE
    for s in physical['design']['stickers']:
        s['ink']=fine['stickerInks'][s['id']]
        if s['symbol']==' ': require(s['ink']=='none','Blank ink')
    certificate=verify_design_and_group(physical,reuse_group=True)
    require(certificate==base['reachabilityCertificate'],'Same geometry, new colors: legal completion theorem must be unchanged')

    # Stronger constructive check: no nonzero optical display rotation is
    # needed for ANY nonblank glyph other than zero.
    restricted=copy.deepcopy(physical)
    for char in restricted['glyphModel']['quarterTurns']:
        if char not in ('0',' '): restricted['glyphModel']['quarterTurns'][char]=[0]
    verify_design_and_group(restricted,reuse_group=True)

    expected_variants={
        'A':dict(FINE,yearDigits=FINE['dateDigits']),
        'B':dict(FINE,weekdayLetters='letter-ink',monthLetters='letter-ink'),
        'B_originalDigitColors':dict(FINE,weekdayLetters='letter-ink',monthLetters='letter-ink',dateDigits='date-digit-ink',timeDigits='time-digit-ink'),
        'C':{f:('separator-ink' if f=='separator' else 'colon-ink' if f=='colon' else 'text-ink') for f in FIELDS},
        'minimal':FINE,
        'minimalChange':dict(weekdayLetters='weekday-black',monthLetters='date-red',dateDigits='time-blue',yearDigits='year-gray',timeDigits='time-blue',separator='year-gray',colon='date-red'),
    }
    expected_partitions=partitions(4)
    require(len(r['variants'])==6 and {c['name'] for c in r['variants']}==set(expected_variants),'Variant enumeration')
    require([c['partition'] for c in r['originalClassPartitions']]==expected_partitions and len(expected_partitions)==15,'Incomplete original-class partition enumeration')

    for case in r['variants']+r['originalClassPartitions']:
        palette=expected_variants[case['name']] if 'name' in case else original_palette(case['partition'])
        require(case['palette']==palette,'Variant palette changed')
        if palette['dateDigits']==palette['timeDigits']:
            projection={}
            for f in FIELDS:
                old=FINE[f]
                require(old not in projection or projection[old]==palette[f],'Color coarsening would split one printed ink')
                projection[old]=palette[f]
            projection['none']='none'
            colored=copy.deepcopy(physical)
            colored['palette']=palette
            for s in colored['design']['stickers']:s['ink']=projection[s['ink']]
            verify_design_and_group(colored,reuse_group=True)
            expected=dict(status='SAT',proofKind='fixed immutable design; independent rigid pose matching and verified common legal completion',inkProjectionFromFine=projection)
        else:
            proof=negative_certificate(palette,base['glyphModel']['quarterTurns'])
            expected=dict(status='UNSAT',proofKind='glyph-aware role separation and paired-wing singleton contradiction',counting=proof)
        if certify:
            case.update(expected)
        else:
            require(all(case.get(k)==v for k,v in expected.items()),'Palette certificate differs')

    altered=copy.deepcopy(base['glyphModel']['quarterTurns'])
    altered['I']=[0,1,2,3]
    require(not role_separation(expected_variants['B_originalDigitColors'],altered),'Do not silently apply the B impossibility proof after changing glyph symmetry')

    # Show minimality: no merger is impossible; one date/time merger succeeds.
    require(r['minimumOriginalClassMerges']==1,'Merge count')
    require(r['minimumRecoloredComponentFields']==1 and r['minimallyRecoloredField']=='dateDigits','Minimal changed field')
    require(r['minimalOriginalClassPair']==['date (digits and month letters)','time digits'],'Minimal pair')
    sat=[c for c in r['originalClassPartitions'] if c['status']=='SAT']
    require(len(sat)==5,'Expected five satisfiable original-class coarsenings')
    pair_merges=[c for c in sat if len(set(c['partition']))==3]
    require(len(pair_merges)==1 and pair_merges[0]['partition']==[0,1,2,1],'Minimal original-class merger not uniquely established in this glyph model')

    # A half-turn-only zero would restore role separation and the 25>24
    # obstruction, even in the most color-permissive common-ink case.
    no_quarter=copy.deepcopy(base['glyphModel']['quarterTurns'])
    no_quarter['0']=[0,2]
    require(negative_certificate(expected_variants['C'],no_quarter)['minimumWingCubies']==25,'Quarter-turn zero necessity not established')
    rotation_rows=r['rotationCertificate']['printRotations']
    require(len(rotation_rows)==150,'Missing printing-angle records')
    byid={s['id']:s for s in base['design']['stickers']}
    fine_to_minimal={FINE[f]:expected_variants['minimalChange'][f] for f in FIELDS}|{'none':'none'}
    for row in rotation_rows:
        s=byid[row['id']]
        expected=dict(id=s['id'],face=['U','D','F','B','R','L'][s['id']//25],row=s['id']%25//5+1,col=s['id']%5+1,
                      symbol=s['symbol'],ink=fine['stickerInks'][s['id']],minimalChangeInk=fine_to_minimal[fine['stickerInks'][s['id']]],printRotationDegrees=independent_print_rotation(s),plannedFrontSlots=s['targetSlots'])
        require(row==expected,'Physical sticker printing angle mismatch')
    with (ROOT/'results/german-palette-printing.csv').open(newline='') as stream:
        rows=list(csv.DictReader(stream))
    require(len(rows)==150,'Printing CSV count')
    for csvrow,record in zip(rows,rotation_rows):
        require(csvrow==dict(id=str(record['id']),face=record['face'],row=str(record['row']),col=str(record['col']),
                            symbol='BLANK' if record['symbol']==' ' else record['symbol'],ink_fine=record['ink'],ink_minimal_change=record['minimalChangeInk'],
                            print_rotation_ccw_degrees=str(record['printRotationDegrees']),
                            planned_front_slots='|'.join(f'{slot//5+1}:{slot%5+1}' for slot in record['plannedFrontSlots'])),'CSV print data differs')
    zeros=[]
    for s in base['design']['stickers']:
        if s['symbol']=='0' and s['targetSlots']==[5,21]:
            poses={}
            for slot in (5,21):
                p=(slot%5-2,2-slot//5,2)
                possibilities=[R for R in ROTATIONS if rotate(s['position'],R)==p and rotate(s['normal'],R)==(0,0,1)]
                require(len(possibilities)==1,'Wing pose not rigidly determined')
                up=rotate(s['up'],possibilities[0])
                poses[slot]={(0,1,0):0,(-1,0,0):90,(0,-1,0):180,(1,0,0):270}[up]
            require(poses=={5:0,21:90},'Critical zero display rotation')
            zeros.append(dict(id=s['id'],dayTensRotationDegrees=0,hourUnitsRotationDegrees=90))
    require(len(zeros)==3,'Three fixed zeros needed in this printing')
    summary=dict(status='VERIFIED',zeroQuarterTurnNecessaryWithinGlyphModel=True,
                 nonzeroDisplayRotationNeededForOtherNonblankGlyphs=False,
                 criticalWingZeroStickers=zeros,
                 sourcePrintingConvention='CCW around outward face normal from the canonical source-face up vector',
                 displayConvention='angle relative to upright text on the target front; all three critical zeros use 0 degrees at day tens and 90 degrees at hour units')
    if certify:
        r['rotationCertificate'].update(summary)
        r['mostSeparatedWitness']['reachabilityCertificate']=certificate
        r['status']='COMPLETE'
        path.write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n')
    else:
        require(all(r['rotationCertificate'].get(k)==v for k,v in summary.items()),'Rotation summary certificate mismatch')
        require(r['mostSeparatedWitness']['reachabilityCertificate']==certificate and r['status']=='COMPLETE','Full positive certificate missing')
    print('VERIFIED DE palettes: A/B/C SAT; B with original digit colors UNSAT; only date/time digits must share ink in the documented glyph model.')
    print('VERIFIED minimal original-class merger, all 15 coarsenings, and display/printing rotations for all 150 stickers.')
    return r
