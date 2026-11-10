// SPDX-License-Identifier: AGPL-3.0-or-later
import test from 'node:test';import assert from 'node:assert/strict';
import {drawFontSticker} from '../src/apps/calendar7/font-art.ts';
import {FONT_STYLES} from '../src/apps/calendar7/fonts.ts';
import {DEFAULT_SCHEME} from '../src/apps/calendar7/schemes.ts';
const glyphs=Object.fromEntries('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(c=>[c,{advance:.6,left:0,right:.5,top:-.75,bottom:0}]));
const font={style:FONT_STYLES[0],family:'test',glyphs,dateSize:100};
for(const theme of ['light','dark'])test(`sheet colors override only canvas ground and lettering (${theme})`,()=>{
 const fill=theme==='light'?'rgb(234, 231, 221)':'rgb(44, 53, 71)',ink=theme==='light'?'rgb(25, 63, 99)':'rgb(169, 203, 242)';
 for(const[text,cls]of[['J','month'],['MON','weekday'],['SUN','red'],['28','red'],['23/30','red'],['7','dark'],['','blank']]){
  const events=[];const ctx={fillStyle:'',fillRect(){events.push(['ground',this.fillStyle]);},fillText(){events.push(['text',this.fillStyle]);},save(){},restore(){},translate(){},scale(){},rotate(){}};
  drawFontSticker(ctx,text,cls,font,DEFAULT_SCHEME,'sticker',{fill,ink});
  assert.equal(events[0][1],fill,text||'blank');for(const e of events.filter(e=>e[0]==='text'))assert.equal(e[1],ink,text);
 }
});

test('cube artwork retains the printed scheme when no sheet colors are supplied',async()=>{
 const {tileRoles}=await import('../src/apps/calendar7/sticker-art.ts');
 for(const[text,cls]of[['J','month'],['MON','weekday'],['SUN','red'],['28','red'],['23/30','red'],['7','dark'],['','blank']]){
  const events=[];const ctx={fillStyle:'',fillRect(){events.push(['ground',this.fillStyle]);},fillText(){events.push(['text',this.fillStyle]);},save(){},restore(){},translate(){},scale(){},rotate(){}};
  drawFontSticker(ctx,text,cls,font,DEFAULT_SCHEME);const roles=tileRoles(DEFAULT_SCHEME,text,cls);
  assert.equal(events[0][1],roles.fill);assert(events.filter(e=>e[0]==='text').every(e=>[roles.ink,roles.inkSmall].includes(e[1])));
 }
});
test('sheet theme listeners repaint and release both observation paths on disposal',async()=>{
 const {watchSheetTheme}=await import('../src/apps/calendar7/sheet-theme.ts');
 const listeners=new Set();let observe,draws=0,stops=0;
 const stop=watchSheetTheme(()=>draws++,{media:{addEventListener(_name,cb){listeners.add(cb);},removeEventListener(_name,cb){listeners.delete(cb);}},observe:cb=>{observe=cb;return()=>stops++;}});
 for(const callback of listeners)callback();observe();assert.equal(draws,2);
 stop();assert.equal(listeners.size,0);assert.equal(stops,1);observe();assert.equal(draws,2);
});
