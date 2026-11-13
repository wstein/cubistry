// Converts a witness JSON into the two plain-text inputs of the Flix checker (flix/).
// Usage: node to-text.mjs WITNESS.json OUT_DIR   (writes printing.txt and targets.txt; files must not exist)
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
const [witness,dir]=process.argv.slice(2);
const w=JSON.parse(readFileSync(witness));
const pr=[...w.printing].sort((a,b)=>a.id-b.id).map(s=>[s.id,s.p.join(' '),s.n.join(' '),s.up.join(' '),'#'+s.image].join('\t'));
const tg=w.targets.map(t=>[[t.weekday,t.day,t.month].join(' '),'#'+t.prelude,'#'+t.word,'#'+t.centerCorrection].join('\t'));
for(const f of ['printing.txt','targets.txt'])if(existsSync(`${dir}/${f}`))throw Error('exists: '+f);
writeFileSync(`${dir}/printing.txt`,pr.join('\n')+'\n');writeFileSync(`${dir}/targets.txt`,tg.join('\n')+'\n');
