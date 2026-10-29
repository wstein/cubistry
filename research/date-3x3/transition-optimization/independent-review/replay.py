import sys,json,pathlib,datetime as dt,copy,hashlib
root=pathlib.Path(__file__).resolve().parent.parent;sys.path.insert(0,str(root));import verify as V
sources={}
for identity,(source,model) in V.SOURCES.items():
 w=json.loads((root/source).read_bytes());c=json.loads((root/model).read_bytes());sources[identity]=(w,c,V.source_state(w['printing'],c))
verified=[]
for path in ['examples.json','chained.json']:
 rows=json.loads((pathlib.Path(__file__).parent/path).read_bytes())
 for row in rows:
  w,c,s=sources[row['id']]
  if path=='examples.json':
   a=dt.date.fromisoformat(row['from']);b=dt.date.fromisoformat(row['to']);pick=lambda d:next(t for t in w['targets'] if (t['weekday'],t['day'],t['month'])==(d.weekday(),d.day,d.month));old,new=pick(a),pick(b);start=V.replay(s,V.canonical_word(old));cells=new['cells'];baseline=V.reduced(V.inverse(V.canonical_word(old))+' '+V.canonical_word(new))
  else:
   start=V.replay(s,row['sourceWord']);cells=row['cells'];b=dt.date.fromisoformat(row['date']);new=next(t for t in w['targets'] if(t['weekday'],t['day'],t['month'])==(b.weekday(),b.day,b.month));assert cells==new['cells'];baseline=V.reduced(V.inverse(row['sourceWord'])+' '+V.canonical_word(new))
  end=V.replay(start,row['word']);V.show(end,cells);assert V.replay(end,V.inverse(row['word']))==start;assert row['counts']==V.counts(row['word']);assert row['baselineCounts']==V.counts(baseline);assert row['counts']['total']<=row['baselineCounts']['total'];assert row['error'] is None;verified.append((path,row['id'],row['counts']['total']))
doc=json.loads((root/'daily-witness-v1.json').read_bytes());rejected=[]
for name,change in [('source hash',lambda d:d['sources'][0].update(sha256='0'*64)),('missing target',lambda d:d['cases'].pop()),('illegal token',lambda d:d['cases'][0].update(word='M')),('wrong legal route',lambda d:d['cases'][0].update(word='R')),('dishonest count',lambda d:d['cases'][0]['counts'].update(total=-1))]:
 x=copy.deepcopy(doc);change(x)
 try:V.validate(x)
 except (AssertionError,ValueError,KeyError):rejected.append(name)
 else:raise AssertionError('Negative control accepted: '+name)
result={'status':'PASS','latestPlannerSHA256':hashlib.sha256((root/'planner.mjs').read_bytes()).hexdigest(),'canonicalExamples':sum(p=='examples.json'for p,_,_ in verified),'chainedActualPoseExamples':sum(p=='chained.json'for p,_,_ in verified),'all54FrameInverseRestorations':len(verified),'negativeControlsRejected':rejected,'costs':verified}
(pathlib.Path(__file__).parent/'replay-result.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))
