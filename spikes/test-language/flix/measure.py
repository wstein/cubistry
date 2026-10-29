#!/usr/bin/env python3
"""Compare identical Flix probe checks via compiler vs compiled JVM entry point."""
import argparse, hashlib, json, os, platform, statistics, subprocess, time
from pathlib import Path
HERE=Path(__file__).resolve().parent

def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def main():
 p=argparse.ArgumentParser();p.add_argument('--output',type=Path,required=True);p.add_argument('--setup',type=Path);a=p.parse_args()
 if a.output.exists():p.error('output must be new')
 a.output.mkdir(parents=True)
 env=os.environ.copy();env.setdefault('FLIX_CACHE_HOME','/tmp/cubistry-flix-cache');env.setdefault('COURSIER_CACHE','/tmp/cubistry-flix-coursier')
 records=[]
 def run(label,cmd,e=env,cwd=HERE):
  t=time.perf_counter();r=subprocess.run(cmd,cwd=cwd,env=e,text=True,capture_output=True,timeout=180);ms=1000*(time.perf_counter()-t)
  (a.output/(label+'.stdout.txt')).write_text(r.stdout);(a.output/(label+'.stderr.txt')).write_text(r.stderr)
  records.append({'label':label,'command':list(map(str,cmd)),'elapsedMs':ms,'exitCode':r.returncode})
  if r.returncode:raise RuntimeError(label+' failed; see saved logs')
  return r
 if a.setup:
  e=env.copy();e['FLIX_CACHE_HOME']=str(a.output/'cold-cache')
  run('cold-setup',['java',str(a.setup),str(a.output/'cold-project'),'--pin','0.79.0'],e)
  lock=a.output/'cold-project/.flixw/lock.toml'
  assert lock.exists() and '8fad2aa09567a7edabcc43f4101fa6199131df2c22929e001c87659d764f6dcf' in lock.read_text(), 'cold setup did not complete its pin'
 for i in range(3):
  r=run('compiler-test-'+str(i),['./flixw','test','--no-install','--threads','2'])
  assert 'Passed: 1, Failed: 0' in r.stdout
 run('build-fatjar',['./flixw','build-fatjar','--no-install','--threads','2'])
 jar=HERE/'artifact/flix.jar'
 for i in range(3):
  r=run('compiled-probe-'+str(i),['java','-jar',str(jar)])
  assert 'PASS: 100 full 24-sticker states, 100 inverses, 6 negative controls' in r.stdout
 result={'scope':'identical geometryChecks(): 100 full 24-sticker states, 100 inverses, six controls; typed fixtures, not full JSON witness-schema port','baselineMain':'377747515be034cf19f656244a20449421b12b1d','spikeHead':subprocess.check_output(['git','rev-parse','HEAD'],cwd=HERE,text=True).strip(),'java':subprocess.run(['java','-version'],capture_output=True,text=True).stderr,'platform':platform.platform(),'wrapperRepository':'https://github.com/wstein/flixw','wrapperReadRevision':'5b627a3c858c80ef351d1f119bf08040dce7d048','wrapperRelease':'0.34.9','setupSHA256':'8db484443e822d200a59bbce1d9a64bb6a679c1446a61724cca0ba51732b77d6','flixVersion':'0.79.0','compilerSHA256':'8fad2aa09567a7edabcc43f4101fa6199131df2c22929e001c87659d764f6dcf','compiledArtifactSHA256':sha(jar),'compiledArtifactBytes':jar.stat().st_size,'codeSHA256':{str(x.relative_to(HERE)):sha(x) for x in [HERE/'src/Main.flix',HERE/'src/Fixtures.flix',HERE/'test/TestMain.flix',HERE/'generate_fixture.py',HERE/'.flixw/lock.toml',Path(__file__)]},'records':records,'compilerMedianMs':statistics.median(x['elapsedMs'] for x in records if x['label'].startswith('compiler-test')),'compiledMedianMs':statistics.median(x['elapsedMs'] for x in records if x['label'].startswith('compiled-probe')),'limits':['shared machine, observed timings only','first compiler acquisition requires network; cached compiler tests use populated wrapper/Coursier caches','fatjar excludes compiler/recompile time; rebuild after source changes','all existing Python verifiers and CI remain unchanged']}
 (a.output/'report.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({k:result[k] for k in ['compilerMedianMs','compiledMedianMs','compiledArtifactBytes']},indent=2))
if __name__=='__main__':main()
