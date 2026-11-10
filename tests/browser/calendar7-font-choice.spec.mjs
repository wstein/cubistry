// SPDX-License-Identifier: AGPL-3.0-or-later
import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';

test('all local styles render uniformly sized dates and separated split ink without clipping',async({page},info)=>{
 await page.goto('/licenses.html');
 const rows=await page.evaluate(async()=>{
  const {FONT_STYLES,loadCalendarFont}=await import('/src/apps/calendar7/fonts.ts');
  const {drawFontSticker,drawFontRun,labelLayout}=await import('/src/apps/calendar7/font-art.ts');
  const {DEFAULT_SCHEME}=await import('/src/apps/calendar7/schemes.ts');
  const out=[];
  for(const style of FONT_STYLES){const font=await loadCalendarFont(style.id,'/'),sizes=[],boxes=[];
   for(const text of [...Array.from({length:31},(_,i)=>String(i+1)),'23/30','24/31','MON','FRI','SUN','SAT','VEM']){
    const c=document.createElement('canvas');c.width=c.height=192;const ctx=c.getContext('2d');
    drawFontSticker(ctx,text,'dark',font,DEFAULT_SCHEME);const data=ctx.getImageData(0,0,192,192).data;
    const bg=[1,3,5].map(i=>parseInt(DEFAULT_SCHEME.dayFill.slice(i,i+2),16));let x0=192,y0=192,x1=-1,y1=-1,count=0;
    for(let y=0;y<192;y++)for(let x=0;x<192;x++){const i=(y*192+x)*4;if(bg.some((v,k)=>Math.abs(data[i+k]-v)>8)){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);count++;}}
    const parts=labelLayout(text,font);if(/^\d+$/.test(text))sizes.push(parts[0].size);
    const partBoxes=parts.length===2?parts.map(part=>{
     const m=document.createElement('canvas');m.width=m.height=192;const mc=m.getContext('2d');mc.fillStyle='#000';drawFontRun(mc,part.text,font,part.size,part.x,part.y);
     const a=mc.getImageData(0,0,192,192).data;let min=192,max=-1;
     for(let y=0;y<192;y++)for(let x=0;x<192;x++)if(a[(y*192+x)*4+3]>8){min=Math.min(min,y);max=Math.max(max,y);}
     return {y0:min,y1:max};
    }):[];
    boxes.push({text,x0,y0,x1,y1,count,parts,partBoxes});
   }
   out.push({id:style.id,sizes,boxes,loaded:document.fonts.check(`${style.weight} 40px "${font.family}"`)});
  }return out;
 });
 await info.attach("font-fit.json",{body:JSON.stringify(rows,null,2),contentType:"application/json"});
 expect(rows).toHaveLength(14);
 for(const row of rows){expect(row.loaded,row.id).toBe(true);expect(new Set(row.sizes).size,row.id).toBe(1);
  for(const box of row.boxes){expect(box.count,`${row.id} ${box.text}`).toBeGreaterThan(0);expect(Math.min(box.x0,box.y0,191-box.x1,191-box.y1),`${row.id} ${box.text} ink margin`).toBeGreaterThanOrEqual(10);
   if(box.parts.length===2)expect(box.partBoxes[1].y0-box.partBoxes[0].y1-1,`${row.id} ${box.text} gap`).toBeGreaterThanOrEqual(12);
  }
 }
});

test('font choices update the real month sheet and cube without changing month or pose',async({page},info)=>{
 await page.goto('/index.html?app=calendar7&year=2026&month=11');
 const root=page.locator('[data-c7-font="noto"]');await expect(root).toHaveAttribute('data-c7-month','2026-11',{timeout:30000});
 const digest=await root.getAttribute('data-c7-digest');
 await page.screenshot({path:info.outputPath('font-noto.png'),fullPage:true});
 await expect(page.locator('.c7-sheet td canvas')).toHaveCount(49);
 for(const id of ['nunito','nova-square','dseg14classic-bold','dseg14modern-regular','noto']){
  await page.getByLabel('Font style',{exact:true}).selectOption(id);
  await expect(page.locator('[data-c7-font]').filter({has:page.locator('.c7-sheet')})).toHaveAttribute('data-c7-font',id);
  await expect(page.locator('[data-c7-digest]')).toHaveAttribute('data-c7-digest',digest);
  await expect(page.locator('[data-c7-month]')).toHaveAttribute('data-c7-month','2026-11');
  await expect(page.locator('.c7-sheet td canvas')).toHaveCount(49);
  if(['nunito','dseg14modern-regular'].includes(id))await page.screenshot({path:info.outputPath(`font-${id}.png`),fullPage:true});
 }
});

test('bad font bytes fall back to verified Noto without losing the current month',async({page})=>{
 await page.route('**/fonts/calendar7/nunito.ttf',route=>route.fulfill({status:200,body:readFileSync('public/fonts/noto-sans-latin-600.woff2'),contentType:'font/woff2'}));
 await page.goto('/index.html?app=calendar7&year=2026&month=11');
 await expect(page.locator('[data-c7-month]')).toHaveAttribute('data-c7-month','2026-11',{timeout:30000});
 const digest=await page.locator('[data-c7-digest]').getAttribute('data-c7-digest');
 await page.getByLabel('Font style',{exact:true}).selectOption('nunito');
 await expect(page.locator('[data-c7-font-status]')).toContainText('Using Noto Sans');
 await expect(page.getByLabel('Font style',{exact:true})).toHaveValue('noto');
 await expect(page.locator('[data-c7-digest]')).toHaveAttribute('data-c7-digest',digest);
});

test('font redraws retain GPU textures, body identity and active layer pivots on both surfaces',async({page})=>{
 await page.goto('/licenses.html');
 const result=await page.evaluate(async()=>{
  const {Calendar7Viewer}=await import('/src/apps/calendar7/viewer.ts');
  const {FONT_STYLES,loadCalendarFont}=await import('/src/apps/calendar7/fonts.ts');
  const {layoutFixture}=await import('/tests/calendar7-fixture.mjs');
  const {printing,pose}=layoutFixture();
  const host=document.createElement('div');host.style.cssText='position:fixed;left:0;top:0;width:480px;height:480px';document.body.append(host);
  const panel=document.createElement('div');document.body.append(panel);
  const viewer=new Calendar7Viewer(host,panel),fonts=[];
  for(const f of FONT_STYLES)fonts.push(await loadCalendarFont(f.id,'/'));
  const rows=[];
  for(const surface of ['sticker','face']){
   viewer.setFont(fonts[0]);viewer.configure(printing,pose,surface);
   await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);
   const uuid=()=>viewer.art.map(a=>a.texture.uuid).join(','),before={uuid:uuid(),resources:viewer.resources.length,textures:viewer.renderer.info.memory.textures,body:viewer.cube,pose:JSON.stringify(viewer.pose),camera:JSON.stringify(viewer.camera.toJSON())};
   for(const font of fonts)viewer.setFont(font);
   await new Promise(requestAnimationFrame);
   rows.push({surface,sameTextures:uuid()===before.uuid,sameResources:viewer.resources.length===before.resources,sameGPU:viewer.renderer.info.memory.textures===before.textures,sameBody:viewer.cube===before.body,samePose:JSON.stringify(viewer.pose)===before.pose,sameCamera:JSON.stringify(viewer.camera.toJSON())===before.camera});
   const children=new Set(viewer.presentation.children);
   const motion=viewer.turn({axis:0,lo:3,hi:3,angle:1,kind:'single'},pose,250);
   const pivot=viewer.presentation.children.find(o=>!children.has(o));
   viewer.setFont(fonts[0]);const running=viewer.tween.running;
   rows.push({surface,running,sameActiveBody:viewer.cube===before.body,sameActiveTextures:uuid()===before.uuid,pivotFound:Boolean(pivot),pivotRetained:viewer.presentation.children.includes(pivot)});
   await motion;
  }
  viewer.destroy();return{rows,disposed:viewer.art.length===0&&viewer.resources.length===0&&host.querySelectorAll('canvas').length===0};
 });
 for(const row of result.rows)for(const [key,value]of Object.entries(row))if(key!=='surface')expect(value,`${row.surface} ${key}`).toBe(true);
 expect(result.disposed).toBe(true);
});

test('the latest font survives delayed font and viewer loading',async({page})=>{
 let releaseViewer,releaseFont;
 const viewerGate=new Promise(r=>releaseViewer=r),fontGate=new Promise(r=>releaseFont=r);
 await page.route('**/src/apps/calendar7/viewer.ts*',async route=>{await viewerGate;await route.continue();});
 await page.route('**/fonts/calendar7/nunito.ttf',async route=>{await fontGate;await route.continue();});
 await page.goto('/index.html?app=calendar7&year=2026&month=11');
 await expect(page.locator('[data-c7-font="noto"]')).toHaveCount(1);
 await page.getByLabel('Font style',{exact:true}).selectOption('nunito');
 await page.getByLabel('Font style',{exact:true}).selectOption('quicksand');
 await expect(page.locator('[data-c7-font="quicksand"]')).toHaveCount(1);
 releaseFont();releaseViewer();
 await expect(page.locator('[data-c7-month]')).toHaveAttribute('data-c7-month','2026-11',{timeout:30000});
 await expect(page.getByLabel('Font style',{exact:true})).toHaveValue('quicksand');
 await expect(page.locator('[data-c7-font="quicksand"]')).toHaveCount(1);
 await expect(page.locator('.c7-sheet td canvas')).toHaveCount(49);
});
