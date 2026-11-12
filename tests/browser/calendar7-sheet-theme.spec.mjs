// SPDX-License-Identifier: AGPL-3.0-or-later
import {test,expect} from '@playwright/test';

async function sample(page){return page.evaluate(()=>{
 const rgb=text=>text.match(/[\d.]+/g).slice(0,3).map(Number);
 const luminance=values=>{const c=values.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});return .2126*c[0]+.7152*c[1]+.0722*c[2];};
 const cells=[...document.querySelectorAll('.c7-sheet td')];
 const choices=[['month',c=>c.classList.contains('c7-ink-month')&&c.textContent],['weekday',c=>c.textContent==='MON'],['weekend name',c=>c.textContent==='SUN'],['weekend date',c=>c.classList.contains('c7-ink-red')&&/^\d+$/.test(c.textContent)],['weekday date',c=>c.classList.contains('c7-ink-dark')&&/^\d+$/.test(c.textContent)],['split',c=>c.textContent.includes('/')],['blank',c=>!c.textContent]];
 return choices.map(([role,find])=>{
  const td=cells.find(find);if(!td)return{role,missing:true};
  const style=getComputedStyle(td),background=rgb(style.backgroundColor),ink=rgb(style.color),canvas=td.querySelector('canvas');
  if(!canvas)return{role,missingCanvas:true};
  const pixels=canvas.getContext('2d').getImageData(0,0,192,192).data,corner=[...pixels.slice(0,3)];let inkCount=0;
  for(let i=0;i<pixels.length;i+=4)if(ink.every((v,k)=>pixels[i+k]===v))inkCount++;
  const[a,b]=[luminance(ink),luminance(corner)].sort((a,b)=>b-a);
  return{role,text:td.textContent,background,ink,corner,inkCount,ratio:(a+.05)/(b+.05)};
 });
});}
async function sameGround(page){return page.evaluate(()=>{const cells=[...document.querySelectorAll('.c7-sheet td')];return cells.length===49&&cells.every(td=>{
 const canvas=td.querySelector('canvas');if(!canvas)return false;
 const css=getComputedStyle(td).backgroundColor.match(/[\d.]+/g).slice(0,3).map(Number),pixel=canvas.getContext('2d').getImageData(0,0,1,1).data;
 return css.every((v,k)=>v===pixel[k]);
});});}

// One test per theme and four fonts: a single 28-step loop took 22 s on a CI runner and 31 s on a loaded one (limit 30 s, issue #444).
const FONT_COUNT=14,CHUNK=4;
async function openAugust(page,theme){
 await page.emulateMedia({colorScheme:'light'});
 await page.goto('/index.html?app=calendar7&year=2026&month=8');
 await expect(page.locator('[data-c7-month]')).toHaveAttribute('data-c7-month','2026-08',{timeout:30000});
 const digest=await page.locator('[data-c7-digest]').getAttribute('data-c7-digest');
 const ids=await page.getByLabel('Font style',{exact:true}).locator('option').evaluateAll(options=>options.map(o=>o.value));expect(ids).toHaveLength(FONT_COUNT);
 await page.emulateMedia({colorScheme:theme});
 await expect.poll(()=>sameGround(page),{message:`canvas follows ${theme} before changing fonts`}).toBe(true);
 return {ids,digest};
}
for(const theme of ['light','dark'])for(let from=0;from<FONT_COUNT;from+=CHUNK){
 test(`font styles ${from + 1} to ${Math.min(from + CHUNK,FONT_COUNT)} retain the accessible HTML palette in the ${theme} theme`,async({page})=>{
  const ids=(await openAugust(page,theme)).ids.slice(from,from+CHUNK);expect(ids.length).toBeGreaterThan(0);
  for(const id of ids){
   await page.getByLabel('Font style',{exact:true}).selectOption(id);await expect(page.locator('[data-c7-font]').filter({has:page.locator('.c7-sheet')})).toHaveAttribute('data-c7-font',id);
   for(const cell of await sample(page)){
    expect(cell.missing,`${theme}/${id}/${cell.role}`).toBeUndefined();expect(cell.missingCanvas).toBeUndefined();
    expect(cell.corner,`${theme}/${id}/${cell.role} actual background`).toEqual(cell.background);
    if(cell.text){expect(cell.inkCount,`${theme}/${id}/${cell.role} actual ink`).toBeGreaterThan(0);expect(cell.ratio,`${theme}/${id}/${cell.role} actual contrast`).toBeGreaterThanOrEqual(4.5);}
   }
  }
 });
}

test('an explicit theme redraws the canvases without changing the month digest',async({page})=>{
 const {ids,digest}=await openAugust(page,'dark');
 const last=ids[FONT_COUNT-1];
 await page.getByLabel('Font style',{exact:true}).selectOption(last);
 await expect(page.locator('[data-c7-font]').filter({has:page.locator('.c7-sheet')})).toHaveAttribute('data-c7-font',last);
 for(const theme of ['light','dark']){
  await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
  await expect.poll(()=>sameGround(page),{message:`canvas follows explicit ${theme}`}).toBe(true);
 }
 await expect(page.locator('[data-c7-digest]')).toHaveAttribute('data-c7-digest',digest);
});
