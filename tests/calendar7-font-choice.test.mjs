// SPDX-License-Identifier: AGPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {FONT_STYLES,fontStyleById,FontSelection,numberLayout} from '../src/apps/calendar7/fonts.ts';
const glyphs=Object.fromEntries('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(c=>[c,{advance:.6,left:0,right:.5,top:-.75,bottom:0}]));
const loaded=id=>({style:fontStyleById(id),family:'test',glyphs,dateSize:100});
test('the finite styles keep Noto default and one exact master per font',()=>{
 assert.equal(FONT_STYLES.length,14);assert.equal(fontStyleById('bogus').id,'noto');
 assert(FONT_STYLES.every(f=>['6','9'].includes(f.master)&&/^[a-f0-9]{64}$/.test(f.sha256)));
 assert.equal(numberLayout('MONFRI',loaded('noto'),80).runs.map(r=>r.text).join(''),'MONFRI');
 for(const f of FONT_STYLES)for(const text of ['6','9','16','19','26','29']){
  const plan=numberLayout(text,loaded(f.id),100);for(const run of plan.runs){
   if(run.input==='6'||run.input==='9'){assert.equal(run.text,f.master);assert.equal(run.turn,run.input===f.master?0:Math.PI);}
  }
 }
});
test('font loading rejects stale completions and disposed updates, and falls back to Noto',async()=>{
 const requests=new Map(),applied=[],notices=[];
 const select=new FontSelection(id=>new Promise((resolve,reject)=>requests.set(id,{resolve,reject})),f=>applied.push(f.style.id),s=>notices.push(s));
 const a=select.choose('nunito'),b=select.choose('quicksand');requests.get('quicksand').resolve(loaded('quicksand'));await b;requests.get('nunito').resolve(loaded('nunito'));await a;assert.deepEqual(applied,['quicksand']);
 const c=select.choose('nova-oval');requests.get('nova-oval').reject(Error('missing'));await Promise.resolve();requests.get('noto').resolve(loaded('noto'));await c;assert.deepEqual(applied,['quicksand','noto']);assert(notices.some(s=>s.includes('Noto')));
 const d=select.choose('nunito');select.dispose();requests.get('nunito').resolve(loaded('nunito'));await d;assert.deepEqual(applied,['quicksand','noto']);
});

test('all dates retain one font size and split numbers have separate lower-right ink boxes',async()=>{
 const {labelLayout}=await import('../src/apps/calendar7/font-art.ts');
 for(const style of FONT_STYLES){const font=loaded(style.id);
  for(let n=1;n<=31;n++)assert.equal(labelLayout(String(n),font)[0].size,font.dateSize);
  for(const text of ['23/30','24/31']){const [a,b]=labelLayout(text,font);assert.equal(a.size,font.dateSize);assert(b.size<a.size);assert(b.box.x1<=178);assert(b.box.y1<=178);assert(b.box.y0-a.box.y1>=12);}
 }
});

test('local font bytes, original licenses and registry pins agree',async()=>{
 const {readFileSync}=await import('node:fs'),{createHash}=await import('node:crypto');
 const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
 const manifest=JSON.parse(readFileSync('public/fonts/calendar7/manifest.json'));
 const licenses=readFileSync('licenses.html','utf8');
 assert.equal(new Set(FONT_STYLES.map(f=>f.id)).size,14);
 assert.equal(manifest['SPDX-License-Identifier'],'CC-BY-SA-4.0');
 for(const style of FONT_STYLES){const entry=manifest.fonts.find(f=>f.id===style.id);assert(entry);assert(licenses.includes(`href="fonts/calendar7/${entry.license}"`));if(entry.sourceCommit){assert.match(entry.sourceCommit,/^[a-f0-9]{40}$/);assert(entry.source.includes(entry.sourceCommit));}assert.equal(sha(readFileSync('public/'+style.path)),style.sha256);assert.equal(entry.sha256,style.sha256);assert.equal(entry.master,style.master);assert.equal(sha(readFileSync('public/fonts/calendar7/'+entry.license)),entry.licenseSHA256);}
});
