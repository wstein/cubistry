"""Independent certificate verification for EN first, then DE.

Uses only the Python standard library. Does not import any experiment code or
trust a certificate's listed domains, non-cooccurrences, or derived bounds.
The single-language certificate assumes upright glyphs with a fixed up vector.
"""
import collections
import datetime as dt
import itertools
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def require(ok, message):
    if not ok:
        raise AssertionError(message)


LOCALES = {
    'EN': ('MON TUE WED THU FRI SAT SUN'.split(), 'JAN FEB MAR APR MAY JUN JUL AUG SEP OCT NOV DEC'.split()),
    'DE': ('MON DIE MIT DON FRE SAM SON'.split(), 'JAN FEB MÄR APR MAI JUN JUL AUG SEP OKT NOV DEZ'.split()),
}
SLOTS = {'positive': (1, 9, 15, 23), 'negative': (3, 5, 19, 21)}
POOLED = {'corners':(0,4,20,24), 'wings':(1,3,5,9,15,19,21,23),
          'middleEdges':(2,10,14,22), 'axialCenters':(7,11,13,17),
          'diagonalCenters':(6,8,16,18), 'fixedCenters':(12,)}
CAPACITIES = dict(corners=24, wings=48, middleEdges=24, axialCenters=24, diagonalCenters=24, fixedCenters=1)


def independent_requirements(language,day_padding='zero'):
    weekdays, months = LOCALES[language]
    domains = {k:set() for k in SLOTS}
    date_domains = {k:set() for k in SLOTS}
    time_domains = {k:set() for k in SLOTS}
    cooccurs = set()
    joint_dates, joint_times = set(), set()
    groups = SLOTS | POOLED
    date_max = {k:collections.Counter() for k in groups}
    time_max = {k:collections.Counter() for k in groups}
    date_projections = {k:set() for k in groups}
    time_projections = {k:set() for k in groups}

    def record(text, is_time):
        (joint_times if is_time else joint_dates).add(tuple(text[i-20 if is_time else i] for i in ((23,21) if is_time else (1,9,15,3,5,19))))
        active = {}
        for side, positions in SLOTS.items():
            active[side] = {(i,text[i-20 if is_time else i]) for i in positions if (i>=20)==is_time}
            domains[side] |= active[side]
            (time_domains if is_time else date_domains)[side].update(active[side])
        cooccurs.update(itertools.product(active['positive'], active['negative']))
        for group, positions in groups.items():
            chars = ''.join(text[i-20 if is_time else i] for i in positions if (i>=20)==is_time)
            maximum = time_max if is_time else date_max
            maximum[group] |= collections.Counter(chars)
            (time_projections if is_time else date_projections)[group].add(chars)

    day = dt.date(2020,1,1)
    dates = 0
    while day < dt.date(2050,1,1):
        record(weekdays[day.weekday()]+'  '+(f'{day.day:2}' if day_padding=='space' else f'{day.day:02}')+months[day.month-1]+' '+str(day.year)+'─────',False)
        day += dt.timedelta(days=1)
        dates += 1
    for minute in range(1440):
        record(f'{minute//60:02}:{minute%60:02}',True)
    cooccurs.update(itertools.product(date_domains['positive'], time_domains['negative']))
    cooccurs.update(itertools.product(time_domains['positive'], date_domains['negative']))
    all_pairs = set(itertools.product(domains['positive'], domains['negative']))
    return dict(joint_dates=joint_dates,joint_times=joint_times,domains=domains, missing=all_pairs-cooccurs, dates=dates,
                inventory={k:date_max[k]+time_max[k] for k in groups},
                date_projections=date_projections, time_projections=time_projections)


def check_certificate(r):
    language = r['language']
    independently = independent_requirements(language)
    cp = r['uprightOnly']
    domains, missing = independently['domains'], independently['missing']
    for side in SLOTS:
        saved = list(map(tuple,cp[side]))
        require(len(saved)==len(set(saved)) and set(saved)==domains[side], f'{language}: role domain mismatch')
        o = r['wingStickerOrbits'][side]
        require(o['frontSlots']==list(SLOTS[side]) and o['availableStickers']==24, 'Wing orbit metadata')
        require(o['symbols']==independently['inventory'][side], 'Wing symbol inventory')
        require(o['lowerBound']==independently['inventory'][side].total(), 'Wing bound')
        require(o['dateProjections']==len(independently['date_projections'][side]), 'Date projection count')
        require(o['timeProjections']==len(independently['time_projections'][side]), 'Time projection count')
    saved_missing = {(tuple(p['positive']),tuple(p['negative'])) for p in cp['neverCooccurs']}
    require(len(saved_missing)==len(cp['neverCooccurs']) and saved_missing==missing, 'Non-cooccurrence certificate')
    require(missing=={((9,'B'),(5,'3'))}, 'Expected February/day-30 exception')
    require(r['validDates']==cp['validDates']==independently['dates']==10958, 'Calendar date count')
    require(r['totalDisplays']==10958*1440, 'Display count')
    for name in POOLED:
        o=r['orbits'][name]
        require(o['frontSlots']==list(POOLED[name]) and o['availableStickers']==CAPACITIES[name], 'Pooled metadata')
        require(o['symbols']==independently['inventory'][name], 'Pooled symbol inventory')
        require(o['lowerBound']==independently['inventory'][name].total(), 'Pooled bound')
        require(o['dateProjections']==len(independently['date_projections'][name]), 'Pooled date projections')
        require(o['timeProjections']==len(independently['time_projections'][name]), 'Pooled time projections')
    require(r['pooledInventoryLowerBound']==sum(independently['inventory'][k].total() for k in POOLED), 'Total pooled bound')

    a, b, n = len(domains['positive']), len(domains['negative']), 24
    e = len({negative for _,negative in missing})
    lower = 2*b-n
    upper = 2*(n-a)+e
    expected = dict(physicalWingCubies=n,positiveRequiredTokens=a,negativeRequiredTokens=b,positiveSlack=n-a,
                    minimumNegativeSingletons=lower,maximumNonessentialPositiveStickers=2*(n-a),
                    maximumNegativeSingletons=upper,contradiction=lower>upper)
    require(cp['counting']==expected, 'Counting arithmetic mismatch')
    require(cp['exceptionalNegativeTokens']==e, 'Exceptional token count')
    require(lower>upper and cp['status']=='UNSAT', 'No established conditional contradiction')
    require(cp['scope']=='conditional; not assumed for the primary result', 'Upright scope not declared')
    return lower, upper


def check_upright_role_invariant():
    # All proper signed-permutation rotations; this is a superset of the
    # possible rotations of a given physical wing. Construct from orthogonal
    # X/Y images and their right-handed cross product, independently of JS.
    unit = [(1,0,0),(-1,0,0),(0,1,0),(0,-1,0),(0,0,1),(0,0,-1)]
    dot = lambda a,b:sum(x*y for x,y in zip(a,b))
    cross = lambda a,b:(a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])
    rotations = [(x,y,cross(x,y)) for x in unit for y in unit if dot(x,y)==0]
    require(len(rotations)==24, 'Rotation group size')
    rotate = lambda p,R:tuple(sum(p[j]*R[j][i] for j in range(3)) for i in range(3))
    # Every exposed wing sticker, every possible printing-up tangent.
    for p in itertools.product(range(-2,3),repeat=3):
        if sorted(map(abs,p)) != [1,2,2]:
            continue
        for normal in unit:
            if dot(p,normal)!=2:
                continue
            for up in unit:
                if dot(up,normal)!=0:
                    continue
                positions = {rotate(p,R) for R in rotations if rotate(normal,R)==(0,0,1) and rotate(up,R)==(0,1,0)}
                require(len(positions)==1, 'An upright sticker can serve multiple positions')
                target = next(iter(positions))
                require(target==(dot(p,cross(up,normal)),dot(p,up),2), 'Dot-product role invariant')


def check_peak_proof(report):
    data=independent_requirements(report['language'],report.get('dayPadding','zero'))
    A,B=data['inventory']['positive'],data['inventory']['negative']
    pairs=set()
    targets=0
    for date in data['joint_dates']:
        for time in data['joint_times']:
            a=collections.Counter(date[:3]+(time[0],))
            b=collections.Counter(date[3:]+(time[1],))
            pairs.update((x,y) for x in a for y in b if a[x]==A[x] and b[y]==B[y])
            targets+=1
    missing=set(itertools.product(A,B))-pairs
    require(missing=={('B','3')}, 'Peak co-occurrence relation')
    p=report['orientationFreeWingProof']
    require(p['requiredA']==A and p['requiredB']==B, 'Peak inventory')
    require(p['projectedTargets']==targets, 'Joint wing targets')
    require(set(map(tuple,p['peakNeverCooccurs']))==missing, 'Peak relation certificate')
    slackA=24-A.total()
    slackB=24-B.total()
    maxA=slackA+sum(sorted(A.values(),reverse=True)[:slackA])
    expected=[]
    for three_tight in (False,True):
        weights=[v for k,v in B.items() if not (three_tight and k=='3')]
        minB=B.total()-sum(sorted(weights,reverse=True)[:slackB])
        exception=min(A['B'],B['3']) if three_tight else 0
        expected.append(dict(threeTight=three_tight,minimumTightB=minB,maximumNonTightA=maxA,maximumExceptionalPairs=exception,contradiction=minB>maxA+exception))
    require(p['slackA']==slackA and p['slackB']==slackB, 'Peak slack')
    require(p['branches']==expected, 'Peak case split')
    require(p['contradiction']==all(b['contradiction'] for b in expected), 'Peak conclusion')
    return p['contradiction']


if __name__=='__main__':
    import argparse
    parser=argparse.ArgumentParser()
    parser.add_argument('--certify',action='store_true')
    parser.add_argument('--palettes',action='store_true')
    parser.add_argument('--space-day',action='store_true')
    parser.add_argument('--language',choices=['EN','DE'])
    args=parser.parse_args()
    check_upright_role_invariant()
    for language,filename in [('EN','english-monochrome.json'),('DE','german-monochrome.json')]:
        if args.language and args.language!=language:
            continue
        report=json.loads((ROOT/'results'/filename).read_text())
        require(report['language']==language, 'Certificate language order')
        check_certificate(report)
        proves_unsat=check_peak_proof(report)
        expected_glyphs={c:([0,1,2,3] if c in '0 ' else [0,2] if c in 'OI─' else [0]) for c in '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZÄ─: '}
        require(report['glyphModel']['quarterTurns']==expected_glyphs,'Shared per-glyph symmetries')
        if language=='EN':
            require(proves_unsat and report['status']=='UNSAT','English conclusion not established')
            print('VERIFIED EN MONOCHROME UNSAT: both orientation-free inventory cases contradict wing cubie coupling.')
        else:
            require(not proves_unsat,'German inventory is not an UNSAT proof')
            from verify_german import verify_design_and_group
            certificate=verify_design_and_group(report)
            if args.certify:
                report['reachabilityCertificate']=certificate
                report['status']='SAT'
                report['reason']='A fixed 150-sticker design with circular zero covers every target; exact group-order and transitivity verification proves a common legal completion.'
                (ROOT/'results'/filename).write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
            else:
                require(report['status']=='SAT' and report['reachabilityCertificate']==certificate,'German SAT certificate mismatch')
            print('VERIFIED DE MONOCHROME SAT: immutable full design, all projected targets, and simultaneous physical reachability.')

    if args.palettes:
        require(args.language!='EN','Palette verification requires the freshly checked German legal group')
        from verify_palette import verify_palettes
        verify_palettes(certify=args.certify)

    if args.space_day:
        require(args.language!='EN','Space-day verification requires the freshly checked German legal group')
        from verify_space_day import verify_space_day
        verify_space_day(certify=args.certify)
