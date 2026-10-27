"""Independent color-aware impossibility check, with glyph rotation relaxed.

The physical two-sign wing pairing is independently verified by verify.py.
No assumption about fixed glyph-up directions is used here.
"""
import json
from pathlib import Path
from verify_single import independent_requirements, require

ROOT=Path(__file__).resolve().parents[1]


def ink(slot,char):
    if char==' ':
        return 'none'
    row=slot//5
    return ['weekday-black','date-red','year-gray','separator-lavender','date-red' if char==':' else 'time-blue'][row]


def verify(r):
    data=independent_requirements(r['language'])
    domains={side:{(slot,char,ink(slot,char)) for slot,char in tokens} for side,tokens in data['domains'].items()}
    for side,tokens in domains.items():
        require(len({(char,color) for _,char,color in tokens})==len(tokens),'Colored glyph can serve multiple roles; count is unsound')
        require(len(r[side])==len(tokens) and set(map(tuple,r[side]))==tokens,'Colored domain mismatch')
    missing={( (a[0],a[1],ink(*a)), (b[0],b[1],ink(*b)) ) for a,b in data['missing']}
    require(missing=={((9,'B','date-red'),(5,'3','date-red'))},'Actual calendar co-occurrence relation')
    require(len(r['neverCooccurs'])==1 and {(tuple(p['positive']),tuple(p['negative'])) for p in r['neverCooccurs']}==missing,'Saved non-cooccurrence certificate')
    a,b,n=len(domains['positive']),len(domains['negative']),24
    e=len({negative for _,negative in missing})
    lower,upper=2*b-n,2*(n-a)+e
    minimum_cubies=(2*(a+b)-e+2)//3
    expected=dict(physicalWingCubies=n,positiveRequiredTokens=a,negativeRequiredTokens=b,positiveSlack=n-a,
                  minimumNegativeSingletons=lower,maximumNonessentialPositiveStickers=2*(n-a),
                  maximumNegativeSingletons=upper,contradiction=lower>upper,minimumWingCubies=minimum_cubies)
    require(r['counting']==expected,'Colored arithmetic')
    require(r['exceptionalNegativeTokens']==e,'Exception count')
    require(lower>upper and minimum_cubies>n and r['status']=='UNSAT','No proved impossibility')
    require(r['validDates']==data['dates']==10958 and r['totalDisplays']==10958*1440,'Date/time coverage')
    require(r['opticalRelaxation']=='All rotations of each glyph are permitted in this impossibility proof; ink color and character identity stay fixed.','No glyph-up assumption allowed')
    require(r['inkConventions']==dict(weekday='weekday-black',dateAndMonth='date-red',year='year-gray',separators='separator-lavender',timeDigits='time-blue',colon='date-red',blank='none'),'Binding color convention')
    require(r['scope']=='binding row colors; unchanged layout and abbreviations','Scope mismatch')
    return minimum_cubies,lower,upper


if __name__=='__main__':
    for language,name in [('EN','english'),('DE','german')]:
        r=json.loads((ROOT/'results'/f'{name}.json').read_text())
        require(r['language']==language,'Language order')
        n,lo,hi=verify(r)
        print(f'VERIFIED {language} colored UNSAT: at least {n} wing cubies required vs 24; at least {lo} singleton B types, at most {hi} possible.')
