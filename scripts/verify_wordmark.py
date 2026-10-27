"""Independent branding verification; fragments are full fixed image tokens.

Arbitrary pixel patterns, including internal multi-color artwork, are allowed.
No visual symmetry, color interchange, reflection, or fragment reordering is used.
"""
import copy
import csv
import json
from pathlib import Path
from verify_single import require
from verify_german import verify_design_and_group,piece_class,target_projections
from verify_palette import independent_print_rotation
from verify_compact import verify_weighted_english

ROOT=Path(__file__).resolve().parents[1]
ART=['wordmark:left','wordmark:middle','wordmark:right']
SLOTS=[16,17,18]


def verify_wordmark(certify=False):
    path=ROOT/'results/german-wordmark.json'
    r=json.loads(path.read_text())
    source=json.loads((ROOT/'results/german-short-separator.json').read_text())
    require(r['language']=='DE' and r['dayPadding']=='space' and r['hourPadding']=='zero' and r['separatorStyle']=='three','Branding scope is the preferred layout')
    require(r['sourceDesign']=='german-short-separator.json' and r['row4Artwork']==ART,'Fragment identities and left-to-right order')
    require(r['wordmark']['fragmentOrder']==ART and r['wordmark']['targetSlots']==SLOTS and r['wordmark']['allowedQuarterTurns']==[0],'All fragments must be upright in their designated cells')
    expected_palette=dict(source['palette'],separator='wordmark-image-assets')
    require(r['palette']==expected_palette,'Calendar/time colors unchanged')
    expected_font=copy.deepcopy(source['glyphModel'])
    for asset in ART:
        expected_font['quarterTurns'][asset]=[0]
        expected_font['definitions'][asset]='distinct immutable upright wordmark image fragment'
    require(r['glyphModel']==expected_font,'Do not invent rotational equivalences of artwork')
    old={s['id']:s for s in source['design']['stickers']}
    actual_fragments=[]
    for s in r['design']['stickers']:
        previous=old[s['id']]
        require(s['position']==previous['position'] and s['normal']==previous['normal'] and s['up']==previous['up'],'Printed image stays attached to its original physical cubie with fixed print direction')
        if previous['symbol']=='─':
            require(len(previous['targetSlots'])==1 and previous['targetSlots'][0] in SLOTS,'Only the three interior separator centers may change')
            slot=previous['targetSlots'][0]
            require(s['symbol']==ART[slot-16] and s['ink']=='wordmark-image-assets','Whole-image identity, not just text or average color')
            require(s['targetSlots']==[slot],'Constant fragment target')
            klass=piece_class(s['position'])
            require(klass==('axialCenters' if slot==17 else 'diagonalCenters'),'Correct center orbit')
            actual_fragments.append(dict(id=s['id'],fragment=s['symbol'],targetSlot=slot,pieceClass=klass))
        else:
            require(s==previous,'Do not reassign other printing or silently spend reserves')
    require(len(actual_fragments)==3 and actual_fragments==r['wordmark']['fragmentStickers'],'Three concrete fixed sticker identities')
    require(len({tuple(old[s['id']]['position']) for s in actual_fragments})==3,'Three distinct physical center cubies')
    require(r['validDates']==10958 and r['totalDisplays']==10958*1440,'Entire date/minute range')
    certificate=verify_design_and_group(r,reuse_group=True)
    upright=copy.deepcopy(r)
    upright['matchingQuarterTurns']={c:([0,1,2,3] if c==' ' else [0]) for c in r['glyphModel']['quarterTurns']}
    verify_design_and_group(upright,reuse_group=True)
    # Keep all 22 previously established reserve positions while the three
    # distinct logo pieces are forced to their exact positions and orientations.
    comparison=json.loads((ROOT/'results/format-comparison.json').read_text())
    preferred=next(c for c in comparison['cases'] if c['name']=='short-separator')
    reserve=preferred['reserveWitness']['ignoredStickerIds']
    require(len(reserve)==22 and not set(reserve)&{f['id'] for f in actual_fragments},'Logo must not consume the claimed reserve positions')
    restricted=copy.deepcopy(r);restricted['ignoredStickerIds']=reserve
    verify_design_and_group(restricted,reuse_group=True)
    # Directly inspect all generated center projections: the three full-image
    # tokens are constant, ordered, and simultaneous with actual calendar data.
    projections=target_projections('space','zero','three',ART)
    for klass in ['axialCenters','diagonalCenters']:
        for target in projections[klass]:
            for slot,char in target:
                if slot in SLOTS:require(char==ART[slot-16],'Brand fragment target is missing or reordered')
    with (ROOT/'results/german-wordmark-printing.csv').open(newline='') as stream:rows=list(csv.DictReader(stream))
    require(len(rows)==150,'Full printing plan must retain all sticker identities')
    for row,s in zip(rows,r['design']['stickers']):
        require(row==dict(id=str(s['id']),face=['U','D','F','B','R','L'][s['id']//25],row=str(s['id']%25//5+1),col=str(s['id']%5+1),image_or_glyph='BLANK' if s['symbol']==' ' else s['symbol'],ink_or_image_asset_group=s['ink'],print_rotation_ccw_degrees=str(independent_print_rotation(s)),planned_front_slots='|'.join(f'{slot//5+1}:{slot%5+1}' for slot in s['targetSlots'])),'Wordmark printing CSV')
    # Branding changes only center targets, so the independently checked
    # English wing impossibility still applies verbatim for this format.
    english=json.loads((ROOT/'results/english-short-separator.json').read_text())
    verify_weighted_english(english)
    # Negative controls establish that branding order/orientation are real
    # predicates of the new verifier rather than inherited unbranded evidence.
    swapped=copy.deepcopy(r)
    left=next(s for s in swapped['design']['stickers'] if s['symbol']==ART[0])
    right=next(s for s in swapped['design']['stickers'] if s['symbol']==ART[2])
    left['symbol'],right['symbol']=right['symbol'],left['symbol']
    rotated=copy.deepcopy(r)
    middle=next(s for s in rotated['design']['stickers'] if s['symbol']==ART[1])
    n,u=middle['normal'],middle['up']
    middle['up']=[n[1]*u[2]-n[2]*u[1],n[2]*u[0]-n[0]*u[2],n[0]*u[1]-n[1]*u[0]]
    for name,bad in [('swapped left/right labels',swapped),('middle fragment printed 90 degrees off',rotated)]:
        try:
            verify_design_and_group(bad,reuse_group=True)
        except AssertionError as failure:
            require('matching' in str(failure),'A negative control must fail the actual target predicate')
        else:raise AssertionError('Incorrect branding was accepted: '+name)
    summary=dict(status='VERIFIED',fragmentsUprightAndOrdered=True,allOtherNonfixedPrintedGlyphsMayBeUpright=True,
                 reservedPrintingPositionsRetained=22,ignoredStickerIds=reserve,
                 English='UNSAT',combined='UNSAT',negativeScope='unchanged wing targets; original inks, and separately the documented glyph model without inks',
                 fullImageComparison='opaque immutable fragment identity plus rigid image frame; internal pixel colors are part of that identity',
                 assetScope='feasibility for any three fixed image fragments; not production artwork validation',
                 rejectedControls=['swapped left/right labels','middle fragment printed 90 degrees off'])
    if certify:
        r['status']='SAT';r['reason']='Three distinct upright full-image fragments share the complete legal date/time construction; independent colored matching and exact common group completion passed.'
        r['reachabilityCertificate']=certificate;r['brandingCertificate']=summary
        path.write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n')
    else:
        require(r['status']=='SAT' and r['reachabilityCertificate']==certificate and r['brandingCertificate']==summary,'Wordmark SAT certificate incomplete')
    print('VERIFIED DE wordmark SAT: three fixed labeled images, upright left/middle/right, all dates/minutes, full legal completion, 22 reserves retained.')
