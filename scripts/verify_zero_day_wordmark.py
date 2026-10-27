"""Independent full rigid-cubie and legal-group verification of zero-day branding."""
import copy,csv,json
from pathlib import Path
from verify_single import require
from verify_german import verify_design_and_group,piece_class,palette_ink,target_projections
from verify_palette import independent_print_rotation
ROOT=Path(__file__).resolve().parents[1]
ART=['wordmark:left','wordmark:middle','wordmark:right']
def verify(certify=False):
    path=ROOT/'results/german-zero-day-wordmark.json'
    r=json.loads(path.read_text())
    require((r['language'],r['dayPadding'],r['hourPadding'],r['separatorStyle'])==('DE','zero','zero','three'),'Exact requested scope')
    require(r['palette']==dict(weekdayLetters='weekday-black',monthLetters='date-red',dateDigits='date-red',yearDigits='year-gray',timeDigits='time-blue',separator='wordmark-image-assets',colon='date-red'),'No ink merging')
    require(r['row4Artwork']==ART and all(r['glyphModel']['quarterTurns'][c]==[0] for c in ART),'Distinct upright opaque full-image identities')
    require(r['validDates']==10958 and r['totalDisplays']==10958*1440,'Entire date/minute domain')
    require(r['wordmark']['targetSlots']==[16,17,18] and r['wordmark']['fragmentOrder']==ART,'Correct fragment positions')
    for c in ART:
        ss=[s for s in r['design']['stickers'] if s['symbol']==c]
        require(len(ss)==1 and piece_class(ss[0]['position'])==('axialCenters' if c==ART[1] else 'diagonalCenters'),'Unique fixed logo sticker in the required center orbit')
    for s in r['design']['stickers']:
        for slot in s['targetSlots']:
            require(s['ink']==palette_ink(r['palette'],slot,s['symbol']),'Immutable ink and advertised role disagree')
    # Fresh exact group-order computation in this process. All 150 identities,
    # all rigid frames, all actual-calendar projections are independently used.
    certificate=verify_design_and_group(r)
    upright=copy.deepcopy(r)
    upright['matchingQuarterTurns']={c:([0,1,2,3] if c==' ' else [0]) for c in r['glyphModel']['quarterTurns']}
    verify_design_and_group(upright,reuse_group=True)
    targets=target_projections('zero','zero','three',ART)
    for t in targets['wings']:
        require(dict(t)[15]==' ' and dict(t)[19]==' ','Both outer logo cells must be blank')
    with (ROOT/'results/german-zero-day-wordmark-printing.csv').open(newline='') as f:rows=list(csv.DictReader(f))
    require(len(rows)==150,'Complete immutable printing plan')
    for row,s in zip(rows,r['design']['stickers']):
        require(row==dict(id=str(s['id']),face=['U','D','F','B','R','L'][s['id']//25],row=str(s['id']%25//5+1),col=str(s['id']%5+1),image_or_glyph='BLANK' if s['symbol']==' ' else s['symbol'],ink_or_image_asset_group=s['ink'],print_rotation_ccw_degrees=str(independent_print_rotation(s)),planned_front_slots='|'.join(f'{slot//5+1}:{slot%5+1}' for slot in s['targetSlots'])),'CSV printing plan differs')
    # Reject actual erroneous printing, rather than only metadata changes.
    for kind in ['red hour zero','rotated logo']:
        bad=copy.deepcopy(r)
        if kind=='red hour zero':
            for s in bad['design']['stickers']:
                if piece_class(s['position'])=='wings' and s['symbol']=='0' and s['ink']=='time-blue':s['ink']='date-red'
        else:
            s=next(s for s in bad['design']['stickers'] if s['symbol']==ART[1]);n,u=s['normal'],s['up']
            s['up']=[n[1]*u[2]-n[2]*u[1],n[2]*u[0]-n[0]*u[2],n[0]*u[1]-n[1]*u[0]]
        try:verify_design_and_group(bad,reuse_group=True)
        except AssertionError as e:require('matching' in str(e),'Control must fail actual target matching')
        else:raise AssertionError('Bad printing accepted: '+kind)
    summary=dict(nonfixedPrintedGlyphsCanAllStayUpright=True,quarterTurnReuseUsesOnlyBlanks=True,negativeControls=['red hour zero','rotated logo'],reserveCountNotEstablished=True,productionArtworkNotPixelValidated=True)
    if certify:
        r.update(status='SAT',reason='New immutable coupled-wing printing plus independent full rigid matching and exact simultaneous legal completion.',reachabilityCertificate=certificate,verification=summary)
        path.write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n')
    else:require(r['status']=='SAT' and r['reachabilityCertificate']==certificate and r['verification']==summary,'Saved certificate differs')
    print('VERIFIED DE zero-padded date + two-digit hour + original separate inks + three upright wordmark fragments: SAT.')
if __name__=='__main__':
    import sys
    verify('--certify' in sys.argv)
