"""Independent check for ' 3OKT' replacing '03OKT', without recoloring rows."""
import copy
import csv
import json
from pathlib import Path
from verify_single import check_peak_proof, require
from verify_german import verify_design_and_group,piece_class,palette_ink
from verify_palette import independent_print_rotation

ROOT=Path(__file__).resolve().parents[1]
PALETTE=dict(weekdayLetters='weekday-black',monthLetters='date-red',dateDigits='date-red',yearDigits='year-gray',timeDigits='time-blue',separator='year-gray',colon='date-red')


def verify_space_day(certify=False):
    en=json.loads((ROOT/'results/english-space-padded.json').read_text())
    require(en['language']=='EN' and en['dayPadding']=='space' and en['status']=='UNSAT','English day style')
    require(en['validDates']==10958 and en['totalDisplays']==10958*1440,'English date coverage')
    require(check_peak_proof(en),'Do not extrapolate old UNSAT without recomputing new requirements')
    path=ROOT/'results/german-space-padded.json'
    de=json.loads(path.read_text())
    base=json.loads((ROOT/'results/german-monochrome.json').read_text())
    require(de['language']=='DE' and de['dayPadding']=='space' and de['palette']==PALETTE,'No ink classes may be merged')
    require(de['validDates']==10958 and de['totalDisplays']==10958*1440,'German date coverage')
    require(de['glyphModel']==base['glyphModel'],'Same shared font model')
    old={s['id']:s for s in base['design']['stickers']}
    changes=[]
    blank_ids=[]
    new_zero_ids=[]
    for s in de['design']['stickers']:
        before=old[s['id']]
        require(s['position']==before['position'] and s['normal']==before['normal'],'Physical identities moved between print plans')
        require(s['ink']=='none' if s['symbol']==' ' else s['ink'] in set(PALETTE.values()),'Invalid immutable ink')
        if before['symbol']!=s['symbol']:
            require(piece_class(s['position'])=='wings','Only five wing glyphs should change')
            if before['symbol']=='0':
                require(s['symbol']==' ' and s['targetSlots']==[3,5] and s['up']==before['up'],'Circular wing zero becomes empty printing')
                blank_ids.append(s['id'])
            else:
                require(before['symbol']==' ' and s['symbol']=='0' and s['targetSlots']==[21] and s['ink']=='time-blue','Old blank becomes time-only blue zero')
                new_zero_ids.append(s['id'])
            changes.append(dict(id=s['id'],**{'from':before['symbol'],'to':s['symbol']},frontRoles=s['targetSlots']))
        else:
            require(s['up']==before['up'] and s['targetSlots']==before['targetSlots'],'Unnecessary print reassignment')
    require(len(changes)==5 and len(blank_ids)==3 and len(new_zero_ids)==2,'Five immutable print changes')
    require(de['fixedWingGlyphChanges']==changes,'Change inventory')
    certificate=verify_design_and_group(de,reuse_group=True)
    lavender=copy.deepcopy(de)
    lavender['palette']['separator']='separator-lavender'
    for sticker in lavender['design']['stickers']:
        if sticker['symbol']=='─':sticker['ink']='separator-lavender'
    verify_design_and_group(lavender,reuse_group=True)
    # Even all nonfixed printed zeros can remain upright. The front fixed
    # center remains a circular zero, whose invisible spin is unrestricted.
    upright=copy.deepcopy(de)
    upright['matchingQuarterTurns']={c:([0,1,2,3] if c==' ' else [0]) for c in de['glyphModel']['quarterTurns']}
    verify_design_and_group(upright,reuse_group=True)
    summary=dict(status='VERIFIED',onlyBlankWingReuseNeedsQuarterTurns=True,
                 nonfixedPrintedGlyphsCanAllStayUpright=True,
                 fixedCenterZero='circular, so invisible center spin remains allowed',
                 sharedBlankWingIds=blank_ids,timeOnlyZeroWingIds=new_zero_ids,
                 rowColorsMerged=False,separatorMayIndependentlyUseLavender=True)
    with (ROOT/'results/german-space-padded-printing.csv').open(newline='') as stream:
        rows=list(csv.DictReader(stream))
    require(len(rows)==150,'Space-padded print CSV count')
    for row,s in zip(rows,de['design']['stickers']):
        require(row==dict(id=str(s['id']),face=['U','D','F','B','R','L'][s['id']//25],row=str(s['id']%25//5+1),col=str(s['id']%5+1),
                          symbol='BLANK' if s['symbol']==' ' else s['symbol'],ink=s['ink'],print_rotation_ccw_degrees=str(independent_print_rotation(s)),
                          planned_front_slots='|'.join(f'{slot//5+1}:{slot%5+1}' for slot in s['targetSlots'])),'Space-padded print CSV content')
    if certify:
        de['status']='SAT'
        de['reason']='Space padding permits reusable unprinted wings; all original row colors and a common legal completion are independently verified.'
        de['reachabilityCertificate']=certificate
        de['displayRotationCertificate']=summary
        path.write_text(json.dumps(de,ensure_ascii=False,indent=2)+'\n')
    else:
        require(de['status']=='SAT' and de['reachabilityCertificate']==certificate and de['displayRotationCertificate']==summary,'Unverified space-padded certificate')
    print('VERIFIED space-padded days: DE SAT with original distinct row colors; EN UNSAT even without ink restrictions.')
    print('VERIFIED nonfixed printed glyphs may all be upright; quarter-turn sharing now uses blanks, not printed wing zeros.')
