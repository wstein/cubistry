"""Construct and independently certify the 2000–2099 extension."""
import copy,json,sys
from pathlib import Path
from verify_german import piece_class,ROTATIONS,rotate,target_projections,verify_design_and_group,require
ROOT=Path(__file__).resolve().parents[1]
source=json.loads((ROOT/'results/german-zero-day-wordmark.json').read_text())
r=copy.deepcopy(source)
r.update(status='UNKNOWN',yearRange=[2000,2099],validDates=36525,totalDisplays=36525*1440,proof='docs/YEAR_CAPACITY.md')
r.pop('reachabilityCertificate',None);r.pop('verification',None)
free=[s for s in r['design']['stickers'] if piece_class(s['position'])=='axialCenters' and s['symbol']==' ']
changes=[]
for s,c in zip(free,'0156789'):
    R=next(R for R in ROTATIONS if rotate(s['position'],R)==(1,0,2) and rotate(s['normal'],R)==(0,0,1))
    s.update(symbol=c,ink='year-gray',up=[R[j][1] for j in range(3)],targetSlots=[13])
    changes.append(dict(id=s['id'],symbol=c,targetSlot=13))
r['yearExtensionPrintChanges']=changes
for k,t in target_projections('zero','zero','three',r['row4Artwork'],r['yearRange']).items():r['design']['packings'][k]['projectedTargets']=len(t)
certificate=verify_design_and_group(r)
upright=copy.deepcopy(r);upright['matchingQuarterTurns']={c:([0,1,2,3] if c==' ' else [0]) for c in r['glyphModel']['quarterTurns']}
verify_design_and_group(upright,reuse_group=True)
r.update(status='SAT',reason='Seven additional immutable gray decade digits; all targets in 2000–2099 independently rigid-matched and legally completed.',reachabilityCertificate=certificate)
path=ROOT/'results/german-wordmark-2000-2099.json'
if '--verify' in sys.argv:
    require(json.loads(path.read_text())==r,'Saved expanded-year certificate differs')
else:path.write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n')
print('VERIFIED DE 2000–2099 SAT: zero-padded dates/hours, original inks, upright wordmark. Seven new gray decade stickers.')
