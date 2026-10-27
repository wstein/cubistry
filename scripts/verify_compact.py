"""Independent time-padding and short-separator comparison; no JS imports."""
import copy
import csv
import json
from pathlib import Path
from verify_single import independent_requirements,check_peak_proof,require
from verify_german import verify_design_and_group,palette_ink,piece_class,chirality
from verify_palette import POSES,independent_print_rotation

ROOT=Path(__file__).resolve().parents[1]
FORMATS=[('hour-space','space','five'),('short-separator','zero','three'),('compact','space','three')]
PALETTE=dict(weekdayLetters='weekday-black',monthLetters='date-red',dateDigits='date-red',yearDigits='year-gray',timeDigits='time-blue',separator='year-gray',colon='date-red')
SLOTS={'A':(1,9,15,23),'B':(3,5,19,21)}


def token(slot,char):
    return (-1 if char==' ' else slot,char)


def verify_weighted_english(report):
    data=independent_requirements('EN','space',report['hourPadding'],'three')
    glyphs=report['glyphModel']['quarterTurns']
    # A nonblank role type is separated either by ink alone (primary proof,
    # accepting every glyph rotation), or by the defined glyph geometry even
    # after dropping all ink distinctions (additional font-scoped result).
    for side,sign in [('A',1),('B',-1)]:
        raw_side='positive' if side=='A' else 'negative'
        domain=data['domains'][raw_side]
        by_color={}
        for slot,char in domain:
            key=(char,palette_ink(PALETTE,slot,char))
            by_color.setdefault(key,set()).add(token(slot,char))
        require(all(len(types)==1 for types in by_color.values()),'Color-only role separation fails')
        for char in {c for _,c in domain}:
            for pattern in POSES[sign]:
                served={token(slot,char) for slot,q in pattern if (slot,char) in domain and q in glyphs[char]}
                require(len(served)<=1,'Do not extrapolate the color-ignored proof to a different font')
    states=[]
    maxima={'A':{},'B':{}}
    for d in data['joint_dates']:
        for t in data['joint_times']:
            chars=d[:3]+(t[0],)+d[3:]+(t[1],)
            state={}
            for side,values in [('A',chars[:4]),('B',chars[4:])]:
                hist={}
                for slot,char in zip(SLOTS[side],values):
                    k=token(slot,char);hist[k]=hist.get(k,0)+1
                state[side]=hist
                for k,n in hist.items():maxima[side][k]=max(maxima[side].get(k,0),n)
            states.append(state)
    coexist=set()
    for state in states:
        coexist.update((a,b) for a,n in state['A'].items() for b,m in state['B'].items() if n==maxima['A'][a] and m==maxima['B'][b])
    missing={(a,b) for a in maxima['A'] for b in maxima['B']}-coexist
    require(missing=={((9,'B'),(5,'3'))},'Actual-calendar weighted exception')
    p=report['glyphAwareWingProof']
    for side in ['A','B']:
        require({tuple(json.loads(k)):n for k,n in p['required'][side].items()}==maxima[side],'Weighted required inventory')
    require({(tuple(a),tuple(b)) for a,b in p['peakNeverCooccurs']}==missing,'Weighted exception certificate')
    a,b=maxima['A'],maxima['B']
    slack_a,slack_b=24-sum(a.values()),24-sum(b.values())
    loose_a=slack_a+sum(sorted(a.values(),reverse=True)[:slack_a])
    tight_b=sum(b.values())-sum(sorted(b.values(),reverse=True)[:slack_b])
    exception=sum(min(a[x],b[y]) for x,y in missing)
    expected=dict(slackA=slack_a,slackB=slack_b,maximumLooseA=loose_a,minimumTightB=tight_b,maximumExceptionalPairs=exception,contradiction=tight_b>loose_a+exception)
    require(p['counting']==expected and expected['contradiction'],'Weighted contradiction')
    require(p['projectedTargets']==len(states),'New-format calendar/time coverage')
    return dict(status='UNSAT',originalRowColorsAllGlyphRotations=True,
                colorIgnoredWithinDocumentedGlyphModel=True,
                minimumTightB=tight_b,maximumLooseA=loose_a,exceptionalPairs=exception)


def verify_reserves(case,de,certify):
    witness=case['reserveWitness']
    ids=witness['ignoredStickerIds']
    require(len(ids)==len(set(ids))==witness['count'],'Reserve positions must be distinct physical sticker IDs')
    require(witness['globallyMaximized'] is False,'Do not confuse a verified reserve with a global optimum')
    byid={s['id']:s for s in de['design']['stickers']}
    expected={s['id'] for s in de['design']['stickers'] if s['symbol']==' ' and (piece_class(s['position']) in ('axialCenters','diagonalCenters') or piece_class(s['position'])=='fixedCenters' and s['position']!=[0,0,2])}
    extra=set(ids)-expected
    require(expected<=set(ids) and len(expected)==21,'Independent center/fixed reserve inventory')
    if de.get('separatorStyle','five')=='three':
        require(len(extra)==1,'One conservative extra wing reserve')
        sticker=byid[next(iter(extra))]
        require(sticker['symbol']==' ' and piece_class(sticker['position'])=='wings' and chirality(tuple(sticker['position']),tuple(sticker['normal']))==-1,'Extra reserve must be a B-side blank wing')
    else:require(not extra,'Unexpected unproved reserve')
    restricted=copy.deepcopy(de);restricted['ignoredStickerIds']=ids
    verify_design_and_group(restricted,reuse_group=True)
    if certify:witness['status']='VERIFIED'
    else:require(witness['status']=='VERIFIED','Reserve certificate missing')


def verify_fine_palette(case,de,certify):
    fields=['weekdayLetters','monthLetters','dateDigits','yearDigits','timeDigits','separator','colon']
    palette={f:f+'-ink' for f in fields}
    fine=case['mostSeparatedWitness']
    require(fine['palette']==palette and fine['inkCount']==7 and len(fine['stickerInks'])==150,'Seven independent component inks')
    witness=copy.deepcopy(de);witness['palette']=palette
    for sticker in witness['design']['stickers']:sticker['ink']=fine['stickerInks'][sticker['id']]
    certificate=verify_design_and_group(witness,reuse_group=True)
    if certify:fine.update(status='SAT',reachabilityCertificate=certificate)
    else:require(fine['status']=='SAT' and fine['reachabilityCertificate']==certificate,'Seven-ink positive certificate')


def verify_compact(certify=False):
    comparison_path=ROOT/'results/format-comparison.json'
    comparison=json.loads(comparison_path.read_text())
    require(comparison['dayPadding']=='space' and comparison['inkPolicy']=='original distinct row colors; no merges','Comparison scope')
    base=json.loads((ROOT/'results/german-space-padded.json').read_text())
    source=json.loads((ROOT/'results/german-monochrome.json').read_text())
    require(base['status']=='SAT','Freshly verified day-space baseline required')
    require(len(comparison['cases'])==4,'All requested isolated and combined cases must be checked')
    old={s['id']:s for s in base['design']['stickers']}
    baseline=comparison['cases'][0]
    require(baseline['name']=='baseline' and baseline['hourPadding']=='zero' and baseline['separatorStyle']=='five' and baseline['DEfile']=='german-space-padded.json' and baseline['ENfile']=='english-space-padded.json','Baseline cell')
    verify_design_and_group(base,reuse_group=True)
    baseline_en=json.loads((ROOT/'results/english-space-padded.json').read_text())
    require(check_peak_proof(baseline_en),'Baseline English proof')
    if certify:baseline.update(DE='SAT',EN='UNSAT',combined='UNSAT',ENWithoutInk='UNSAT',ENWithoutInkScope='all glyph rotations allowed')
    else:require(baseline['DE']=='SAT' and baseline['EN']=='UNSAT' and baseline['combined']=='UNSAT','Baseline outcomes')
    verify_fine_palette(baseline,base,certify)
    verify_reserves(baseline,base,certify)
    for (name,hour,sep),case in zip(FORMATS,comparison['cases'][1:]):
        require(case['name']==name and case['hourPadding']==hour and case['separatorStyle']==sep,'Format case enumeration')
        de_path=ROOT/'results'/f'german-{name}.json'
        en_path=ROOT/'results'/f'english-{name}.json'
        de,en=json.loads(de_path.read_text()),json.loads(en_path.read_text())
        for r,lang in [(de,'DE'),(en,'EN')]:
            require(r['language']==lang and r['dayPadding']=='space' and r['hourPadding']==hour and r['separatorStyle']==sep,'No silent layout changes')
            require(r['validDates']==10958 and r['totalDisplays']==10958*1440,'Date/minute coverage')
            require(r['glyphModel']==source['glyphModel'],'Font rules must be shared between all cases')
        require(de['palette']==PALETTE,'No ink merge allowed')
        changes=[]
        for s in de['design']['stickers']:
            before=old[s['id']]
            require(s['position']==before['position'] and s['normal']==before['normal'] and s['up']==before['up'],'Only the requested immutable glyph/ink printing changes are used')
            expected=before['symbol']
            if hour=='space' and before['symbol']=='0' and before['targetSlots']==[20]:expected=' '
            if sep=='three' and before['symbol']=='─':expected=' ' if piece_class(before['position'])=='wings' else '─'
            require(s['symbol']==expected,'Unexpected glyph modification')
            if before['symbol']!=s['symbol']:changes.append(dict(id=s['id'],**{'from':before['symbol'],'to':s['symbol']}))
        require(changes==de['additionalPrintChanges'],'Fixed-print change list')
        require(case['DEfile']==f'german-{name}.json' and case['ENfile']==f'english-{name}.json','Case artifact paths')
        certificate=verify_design_and_group(de,reuse_group=True)
        verify_fine_palette(case,de,certify)
        verify_reserves(case,de,certify)
        upright=copy.deepcopy(de)
        upright['matchingQuarterTurns']={c:([0,1,2,3] if c==' ' else [0]) for c in de['glyphModel']['quarterTurns']}
        verify_design_and_group(upright,reuse_group=True)
        lavender=copy.deepcopy(de);lavender['palette']['separator']='separator-lavender'
        for sticker in lavender['design']['stickers']:
            if sticker['symbol'] in ('─','-'):sticker['ink']='separator-lavender'
        verify_design_and_group(lavender,reuse_group=True)
        rotation=dict(nonfixedPrintedGlyphsCanAllStayUpright=True,quarterTurnReuseUsesOnlyBlanks=True,
                      fixedCenterZero='circular, so invisible spin remains allowed',separatorCanBeIndependentLavender=True)
        if sep=='five':
            require(check_peak_proof(en),'Hour padding alone does not invalidate the recomputed wing proof')
            english_proof=dict(status='UNSAT',orientationFreeEvenWithoutColors=True)
        else:
            english_proof=verify_weighted_english(en)
        if certify:
            de['status']='SAT';de['reason']='Independent colored rigid-cubie cover and exact common legal completion for the requested format.'
            de['reachabilityCertificate']=certificate;de['displayRotationCertificate']=rotation
            en['status']='UNSAT';en['verification']=english_proof
            case.update(DE='SAT',EN='UNSAT',combined='UNSAT',ENWithoutInk='UNSAT',ENWithoutInkScope='all glyph rotations allowed' if sep=='five' else 'documented glyph symmetry model')
            de_path.write_text(json.dumps(de,ensure_ascii=False,indent=2)+'\n')
            en_path.write_text(json.dumps(en,ensure_ascii=False,indent=2)+'\n')
        else:
            require(de['status']=='SAT' and de['reachabilityCertificate']==certificate and de['displayRotationCertificate']==rotation,'German compact SAT certificate')
            require(en['status']=='UNSAT' and en['verification']==english_proof and case['DE']=='SAT' and case['EN']=='UNSAT' and case['combined']=='UNSAT','English compact certificate')
        with (ROOT/'results'/f'german-{name}-printing.csv').open(newline='') as stream:rows=list(csv.DictReader(stream))
        require(len(rows)==150,'Every printing CSV must include all physical stickers')
        for row,s in zip(rows,de['design']['stickers']):
            require(row==dict(id=str(s['id']),face=['U','D','F','B','R','L'][s['id']//25],row=str(s['id']%25//5+1),col=str(s['id']%5+1),symbol='BLANK' if s['symbol']==' ' else s['symbol'],ink=s['ink'],print_rotation_ccw_degrees=str(independent_print_rotation(s)),planned_front_slots='|'.join(f'{slot//5+1}:{slot%5+1}' for slot in s['targetSlots'])),'Compact CSV mismatch')
        print(f'VERIFIED {name}: DE SAT with unchanged row inks, EN UNSAT; all nonfixed printed glyphs may be upright.')
    if certify:
        comparison['status']='COMPLETE'
        comparison_path.write_text(json.dumps(comparison,ensure_ascii=False,indent=2)+'\n')
    else:require(comparison['status']=='COMPLETE','Unverified format comparison')
