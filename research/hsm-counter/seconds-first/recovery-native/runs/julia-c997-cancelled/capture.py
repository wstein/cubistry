# Process instrumentation only; no proof parsing or verdict computation.
import hashlib,json,os,pathlib,resource,subprocess,sys,time
out=pathlib.Path(sys.argv[1]);out.mkdir(exist_ok=True)
command=sys.argv[2:]
start=time.monotonic();started=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())
with (out/'stdout.jsonl').open('wb') as stdout,(out/'stderr.txt').open('wb') as stderr:
    result=subprocess.run(command,stdout=stdout,stderr=stderr)
usage=resource.getrusage(resource.RUSAGE_CHILDREN)
record={'command':command,'cwd':os.getcwd(),'startedUTC':started,'elapsedSeconds':time.monotonic()-start,'exitCode':result.returncode,'userSeconds':usage.ru_utime,'systemSeconds':usage.ru_stime,'maximumResidentKiB':usage.ru_maxrss,'hashes':{str(f):hashlib.sha256(f.read_bytes()).hexdigest() for f in [out/'stdout.jsonl',out/'stderr.txt',pathlib.Path('proof-checkers/julia/Recovery.jl'),pathlib.Path('proof-checkers/julia/recovery.jl'),pathlib.Path('/tmp/hsm-recovery-source.json'),pathlib.Path('/tmp/hsm-modes-source.json')]}}
(out/'capture.json').write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps(record));sys.exit(result.returncode)
