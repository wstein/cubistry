// SPDX-License-Identifier: AGPL-3.0-or-later
import {test,expect} from '@playwright/test';

test('Calendar7 always draws stickerless faces despite legacy hints and stored appearance',async({page})=>{
 await page.goto('/licenses.html');
 const result=await page.evaluate(async()=>{
  const {Calendar7Viewer}=await import('/src/apps/calendar7/viewer.ts');
  const {layoutFixture}=await import('/tests/calendar7-fixture.mjs');
  const {loadCalendarFont}=await import('/src/apps/calendar7/fonts.ts');
  const{printing,pose}=layoutFixture(),host=document.createElement('div'),panel=document.createElement('div');host.style.cssText='position:fixed;left:0;top:0;width:480px;height:480px';document.body.append(host,panel);
  const key='cubistry-viewer-appearance-v1:/index.html',saved=JSON.stringify({version:1,construction:'stickered',frameColor:'#ff0000'});localStorage.setItem(key,saved);
  const viewer=new Calendar7Viewer(host,panel);viewer.setFont(await loadCalendarFont('noto','/'));const rows=[];
  for(const hint of [undefined,'sticker','face']){
   viewer.configure(printing,pose,hint);let visible=0,mapped=0;const cut=new Set();
   viewer.presentation.traverse(o=>{if(o.userData.stickerId!==undefined&&o.visible)visible++;if(o.userData.sourceFaceStickerIds&&Array.isArray(o.material))o.material.forEach((m,i)=>{if(o.userData.sourceFaceStickerIds[i]===null)cut.add(m.color.getHexString());else if(m.map)mapped++;});});
   rows.push({hint:hint??'omitted',visible,mapped,surface:viewer.surface,cut:[...cut],core:viewer.cube.coreMaterial.color.getHexString()});
  }
  const preserved=localStorage.getItem(key)===saved;viewer.destroy();return{rows,preserved,constructionControls:panel.querySelectorAll('[aria-label="Cube construction"]').length};
 });
 for(const row of result.rows){expect(row.surface,row.hint).toBe('face');expect(row.visible,row.hint).toBe(0);expect(row.mapped,row.hint).toBe(294);expect(row.cut,row.hint).toEqual(['ffffff']);expect(row.core,row.hint).toBe('ffffff');}
 expect(result.preserved).toBe(true);expect(result.constructionControls).toBe(0);
});

test('idle and queued color changes retain texture, body, geometry, camera and pivot identities',async({page})=>{
 await page.goto('/licenses.html');const result=await page.evaluate(async()=>{
  const{Calendar7Viewer}=await import('/src/apps/calendar7/viewer.ts');const{layoutFixture}=await import('/tests/calendar7-fixture.mjs');const{loadCalendarFont}=await import('/src/apps/calendar7/fonts.ts');const{schemeById}=await import('/src/apps/calendar7/schemes.ts');
  const{printing,pose}=layoutFixture(),host=document.createElement('div'),panel=document.createElement('div');host.style.cssText='position:fixed;left:0;top:0;width:480px;height:480px';document.body.append(host,panel);const viewer=new Calendar7Viewer(host,panel);viewer.setFont(await loadCalendarFont('noto','/'));viewer.configure(printing,pose,'face');
  const textures=()=>viewer.art.map(a=>a.texture.uuid).join(),geometries=()=>{const ids=[];viewer.presentation.traverse(o=>{if(o.isMesh)ids.push(o.geometry.uuid);});return ids.sort().join();};
  const before={textures:textures(),geometries:geometries(),body:viewer.cube,resources:viewer.resources.length,camera:JSON.stringify(viewer.camera.toJSON()),pose:JSON.stringify(viewer.pose)};
  viewer.setScheme('dracula');const idle={sameTextures:textures()===before.textures,sameBody:viewer.cube===before.body,sameGeometry:geometries()===before.geometries,sameResources:viewer.resources.length===before.resources,sameCamera:JSON.stringify(viewer.camera.toJSON())===before.camera,samePose:JSON.stringify(viewer.pose)===before.pose,core:viewer.cube.coreMaterial.color.getHexString()};
  const children=new Set(viewer.presentation.children),motion=viewer.turn({axis:0,lo:3,hi:3,angle:1,kind:'single'},pose,120),pivot=viewer.presentation.children.find(c=>!children.has(c));
  viewer.setScheme('monokai');viewer.setScheme('gruvbox-dark');const active={running:viewer.tween.running,sameBody:viewer.cube===before.body,sameTextures:textures()===before.textures,pivotRetained:!!pivot&&viewer.presentation.children.includes(pivot),core:viewer.cube.coreMaterial.color.getHexString()};
  await motion;const final={sameBody:viewer.cube===before.body,sameTextures:textures()===before.textures,sameGeometry:geometries()===before.geometries,sameResources:viewer.resources.length===before.resources,sameCamera:JSON.stringify(viewer.camera.toJSON())===before.camera,core:viewer.cube.coreMaterial.color.getHexString(),want:schemeById('gruvbox-dark').dayFill.slice(1)};
  viewer.destroy();return{idle,active,final};
 });
 for(const set of[result.idle,result.active,result.final])for(const[key,value]of Object.entries(set))if(!['core','want'].includes(key))expect(value,key).toBe(true);
 expect(result.idle.core).toBe('282a36');expect(result.active.core).toBe('282a36');expect(result.final.core).toBe(result.final.want);
});

test('the color picker works by keyboard at 360px, preserves fonts and sheet colors, and restores the URL choice',async({page},info)=>{
 await page.addInitScript(()=>localStorage.setItem('cubistry-viewer-appearance-v1:/index.html',JSON.stringify({version:1,construction:'stickered',frameColor:'#ff0000'})));
 await page.setViewportSize({width:360,height:800});
 await page.goto('/index.html?app=calendar7&year=2026&month=11&font=nunito&scheme=unknown&extra=keep&construction=stickered');
 const root=page.locator('#calendar7-root'),select=page.getByLabel('Cube color theme',{exact:true});await expect(root).toHaveAttribute('data-c7-month','2026-11',{timeout:30000});
 await expect(select).toHaveValue('paper-red');await expect(select.locator('option')).toHaveCount(10);await expect(select).toBeEnabled();await expect(page.locator('[data-c7="speed"]')).toBeDisabled();
 const digest=await root.getAttribute('data-c7-digest'),saved=await page.evaluate(()=>localStorage.getItem('cubistry-viewer-appearance-v1:/index.html'));
 await page.getByLabel('Font style',{exact:true}).selectOption('quicksand');await expect(root).toHaveAttribute('data-c7-font','quicksand');
 const palette=()=>page.locator('.c7-sheet td').evaluateAll(cells=>cells.map(c=>{const s=getComputedStyle(c);return[s.color,s.backgroundColor];}));const before=await palette();
 await select.focus();await select.press('Home');await select.press('ArrowDown');await expect(select).toHaveValue('paper-blue');await expect(root).toHaveAttribute('data-c7-scheme','paper-blue');await expect(select).toBeFocused();
 await expect(root).toHaveAttribute('data-c7-font','quicksand');await expect(root).toHaveAttribute('data-c7-digest',digest);expect(await palette()).toEqual(before);
 const query=new URL(page.url()).searchParams;expect(query.get('scheme')).toBe('paper-blue');for(const[k,v]of[['month','11'],['year','2026'],['font','nunito'],['extra','keep']])expect(query.get(k)).toBe(v);
 const bounds=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,controls:[...document.querySelectorAll('.c7-appearance-choices select')].map(el=>{const r=el.getBoundingClientRect();return{left:r.left,right:r.right};})}));expect(bounds.scroll).toBeLessThanOrEqual(bounds.width+1);for(const b of bounds.controls){expect(b.left).toBeGreaterThanOrEqual(0);expect(b.right).toBeLessThanOrEqual(bounds.width);}
 await page.screenshot({path:info.outputPath('calendar7-color-picker-mobile.png')});
 await page.setViewportSize({width:1280,height:1000});await page.screenshot({path:info.outputPath('calendar7-color-picker-desktop.png')});
 await page.reload();await expect(root).toHaveAttribute('data-c7-month','2026-11',{timeout:30000});await expect(select).toHaveValue('paper-blue');await expect(root).toHaveAttribute('data-c7-digest',digest);expect(await page.evaluate(()=>localStorage.getItem('cubistry-viewer-appearance-v1:/index.html'))).toBe(saved);await expect(page.getByRole('combobox',{name:'Cube construction',exact:true})).toHaveCount(0);
});

test('a color selected while the viewer loads reaches the first cube',async({page})=>{
 let release;const gate=new Promise(r=>release=r);await page.route('**/src/apps/calendar7/viewer.ts*',async route=>{await gate;await route.continue();});
 await page.goto('/index.html?app=calendar7&year=2026&month=11&scheme=paper-blue');const select=page.getByLabel('Cube color theme',{exact:true});await expect(select).toHaveValue('paper-blue');await select.selectOption('dracula');await expect(page.locator('#calendar7-root')).toHaveAttribute('data-c7-scheme','dracula');release();await expect(page.locator('#calendar7-root')).toHaveAttribute('data-c7-month','2026-11',{timeout:30000});await expect(select).toHaveValue('dracula');
});

for(const width of [320,360,390])test(`the font and color selectors share one touch-sized row at ${width}px and keep their names`,async({page})=>{
 await page.setViewportSize({width,height:844});
 await page.goto('/index.html?app=calendar7&year=2026&month=11');
 await expect(page.locator('#calendar7-root')).toHaveAttribute('data-c7-month','2026-11',{timeout:30000});
 const font=page.getByRole('combobox',{name:'Font style',exact:true}),theme=page.getByRole('combobox',{name:'Cube color theme',exact:true});
 const[f,t]=await Promise.all([font.boundingBox(),theme.boundingBox()]);
 expect(Math.abs(f.y-t.y),'same row').toBeLessThan(1);expect(f.height).toBeGreaterThanOrEqual(44);expect(t.height).toBeGreaterThanOrEqual(44);
 expect(f.x+f.width).toBeLessThanOrEqual(t.x);expect(t.x+t.width).toBeLessThanOrEqual(width);expect(f.x).toBeGreaterThanOrEqual(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
});

test('a 3D failure disables the color theme selector together with the other playback controls',async({page})=>{
 await page.route('**/src/apps/calendar7/viewer.ts*',route=>route.abort());
 await page.goto('/index.html?app=calendar7&year=2026&month=11');
 await expect(page.locator('#calendar7-root')).toHaveAttribute('data-c7-state','failed',{timeout:30000});
 await expect(page.getByLabel('Cube color theme',{exact:true})).toBeDisabled();
 await expect(page.locator('[data-c7="speed"]')).toBeDisabled();
 await expect(page.getByLabel('Font style',{exact:true})).toBeEnabled();
});
