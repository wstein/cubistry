#!/usr/bin/env python3
"""Driver only: native Flix performs every proof/data/optics check."""
from pathlib import Path
import argparse
import hashlib
import os
import shutil
import subprocess
import time

root=Path(__file__).resolve().parent
os.chdir(root)
parser=argparse.ArgumentParser()
parser.add_argument('--no-build',action='store_true')
parser.add_argument('--dag',type=Path,default=root/'../../en-physical-review/all-targets-dag.tsv')
args=parser.parse_args()
env=dict(os.environ)
env.setdefault('FLIX_CACHE_HOME','/workspace/shared/calendar-tooling/flix-cache')
env.setdefault('COURSIER_CACHE','/workspace/shared/calendar-tooling/coursier-cache')
if not args.no_build:
    start=time.perf_counter()
    with open('build.log','w') as out:
        subprocess.run(['./flixw','build-jar'],env=env,stdout=out,stderr=subprocess.STDOUT,check=True)
    Path('build-timing.tsv').write_text(f'build-wall-seconds\t{time.perf_counter()-start:.6f}\n')
jar=root/'artifact/flix.jar'
evidence=(root/'../evidence').resolve()
geometry=(root/'../../en-physical-review').resolve()
records=[]
def run(name,command,expected):
    start=time.perf_counter()
    result=subprocess.run(['java','-Xmx8g','-jar',str(jar),*map(str,command)],capture_output=True)
    wall=time.perf_counter()-start
    Path(f'{name}.stdout.tsv').write_bytes(result.stdout)
    Path(f'{name}.stderr.log').write_bytes(result.stderr)
    assert result.returncode==expected,(name,result.returncode,result.stderr,result.stdout[-1000:])
    records.append(f'{name}\t{result.returncode}\t{wall:.6f}\n')
run('selftest',['selftest',evidence,geometry],0)
run('legal',['legal',evidence,geometry,args.dag.resolve()],0)
subprocess.run(['python3','compare_states.py'],check=True)

fixtures=root/'negative-controls'
fixtures.mkdir(exist_ok=True)
identity='cubistry.calendar7.legal-dag.v1\t264\t21\n'+''.join(f'generator\t{i}\t{i}\n' for i in range(1,22))+''.join(f'result\t{i}\t0\n' for i in range(1,92))
valid_dag=fixtures/'identity-legal.dag.tsv'
valid_dag.write_text(identity)
run('identity-dag-membership',['dag',geometry,valid_dag],0)
run('identity-wrong-targets',['legal',evidence,geometry,valid_dag],1)
negative={
    'foreign-seed':identity.replace('generator\t21\t21\n','generator\t21\t22\n'),
    'missing-seed':identity.replace('generator\t21\t21\n',''),
    'forward-reference':identity.replace('result\t1\t0\n','product\t22\t23\t1\nresult\t1\t22\n'),
    'node-gap':identity.replace('result\t1\t0\n','product\t23\t1\t2\nresult\t1\t23\n'),
    'product-after-result':identity+'product\t22\t1\t2\n',
    'unknown-result':identity.replace('result\t1\t0\n','result\t1\t22\n'),
    'duplicate-result':identity.replace('result\t91\t0\n','result\t90\t0\n'),
    'missing-result':identity.replace('result\t91\t0\n',''),
    'noncanonical-integer':identity.replace('generator\t1\t1\n','generator\t01\t1\n'),
    'wrong-degree':identity.replace('legal-dag.v1\t264\t21','legal-dag.v1\t263\t21'),
    'crlf':identity.replace('\n','\r\n'),
    'missing-final-lf':identity[:-1],
}
for name,text in negative.items():
    assert text!=identity
    path=fixtures/f'{name}.dag.tsv';path.write_bytes(text.encode())
    run(name,['dag',geometry,path],1)

# Data corruptions use copies; original physical evidence is never changed.
for case in ['core-up','nonblank239','missing-sticker','wrong-targets']:
    directory=fixtures/case;directory.mkdir(exist_ok=True)
    for filename in ['physical-print.tsv','targets.tsv','front-matches.tsv']:
        shutil.copyfile(evidence/filename,directory/filename)
    printing=directory/'physical-print.tsv'
    rows=[line.split('\t') for line in printing.read_text().splitlines()]
    if case=='core-up':
        for row in rows[1:]:
            pos=list(map(int,row[2].split(',')))
            if sum(v!=0 for v in pos)==1 and row[5]:
                n=list(map(int,row[3].split(',')));u=list(map(int,row[4].split(',')))
                rotated=[n[1]*u[2]-n[2]*u[1],n[2]*u[0]-n[0]*u[2],n[0]*u[1]-n[1]*u[0]]
                row[4]=','.join(map(str,rotated));break
        else: raise AssertionError('no printed core')
    elif case=='nonblank239':
        row=next(r for r in rows[1:] if r[5]);row[5]='';row[6]='blank'
    elif case=='missing-sticker': rows.pop()
    else:
        path=directory/'targets.tsv';path.write_text(path.read_text().replace('1\t2026\t1\n','1\t2027\t1\n'))
    printing.write_text(''.join('\t'.join(row)+'\n' for row in rows))
    run(case,['data',directory,geometry],1)
# Root-cause regression: unused blank sticker25 must still have a real axis up.
# Exact original exploit was accepted before finite membership replaced norm².
base_rows=[line.split('\t') for line in (evidence/'physical-print.tsv').read_text().splitlines()]
assert base_rows[25][0]=='25' and base_rows[25][3]=='0,0,1' and base_rows[25][5]==''
axis_cases={
    'overflow-unused-blank':('0,0,1','65536,1,0',1),
    'up-int32-min':('0,0,1','-2147483648,1,0',1),
    'up-int32-max':('0,0,1','2147483647,1,0',1),
    'up-out-of-range':('0,0,1','2147483648,1,0',1),
    'up-zero':('0,0,1','0,0,0',1),
    'up-diagonal':('0,0,1','1,1,0',1),
    'normal-overflow':('65536,0,1','0,1,0',1),
    'up-not-tangent':('0,0,1','0,0,1',1),
    'normal-inward':('0,0,-1','0,1,0',1),
    'valid-unused-blank-axis':('0,0,1','1,0,0',0),
}
for case,(normal,up,expected) in axis_cases.items():
    directory=fixtures/case;directory.mkdir(exist_ok=True)
    for filename in ['targets.tsv','front-matches.tsv']:
        shutil.copyfile(evidence/filename,directory/filename)
    rows=[row[:] for row in base_rows]
    rows[25][3]=normal;rows[25][4]=up
    (directory/'physical-print.tsv').write_text(''.join('\t'.join(row)+'\n' for row in rows))
    run(case,['data',directory,geometry],expected)
Path('checks.tsv').write_text('case\texit\twall-seconds\n'+''.join(records))
metadata=[]
for path in [*sorted((root/'src').glob('*.flix')),root/'flix.jar',jar,evidence/'physical-print.tsv',evidence/'targets.tsv',evidence/'front-matches.tsv',args.dag.resolve()]:
    metadata.append(f'sha256\t{path.relative_to(root) if path.is_relative_to(root) else path}\t{hashlib.sha256(path.read_bytes()).hexdigest()}\n')
metadata.append(subprocess.run(['java','--version'],capture_output=True,check=True).stdout.decode())
metadata.append(subprocess.run(['./flixw','--version'],env=env,capture_output=True,check=True).stdout.decode())
Path('toolchain.log').write_text(''.join(metadata))
print('PASS: native full91 legal physical replay,888-month coverage,240 minimum; all91 Julia/Flix state hashes match; generator/optics tests,26 negative controls and valid unused-blank axis regression pass.')
