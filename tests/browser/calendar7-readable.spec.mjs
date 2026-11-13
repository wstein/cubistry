// SPDX-License-Identifier: AGPL-3.0-or-later
import { test, expect } from "@playwright/test";
const ROOT="#calendar7-root";
const idle=(page,month)=>expect(page.locator(ROOT)).toHaveAttribute("data-c7-month",month,{timeout:30000});
async function controlled(page, ym="2026&month=11") {
  await page.goto(`/index.html?app=calendar7&year=${ym}`);
  await idle(page,ym.replace("&month=","-").replace(/-(\d)$/,"-0$1"));
  await page.emulateMedia({reducedMotion:"no-preference"});
  await page.evaluate(async()=>{
    const {Calendar7Viewer}=await import('/src/apps/calendar7/viewer.ts');
    window.c7turns=[];
    Calendar7Viewer.prototype.turn=function(block){
      window.c7turns.push({...block});
      return new Promise(resolve=>{window.c7release=resolve});
    };
  });
}
async function enterBlocks(page){
  for(let i=0;i<4;i++){
    if(await page.locator(ROOT).getAttribute("data-c7-phase")==="blocks")return;
    await page.evaluate(()=>window.c7release());
  }
  await expect(page.locator(ROOT)).toHaveAttribute("data-c7-phase","blocks");
}
test("default prefix is free x/y orientation and the active word keeps its actual from/to plan",async({page})=>{
  await controlled(page);
  await expect(page.locator('[data-c7="orientation"]')).toHaveValue("before");
  await page.locator('a[data-nav="next"]').click();
  await expect(page.locator(ROOT)).toHaveAttribute("data-c7-phase","orientation");
  expect(await page.evaluate(()=>window.c7turns[0].kind)).toBe("rotation");
  expect(await page.evaluate(()=>window.c7turns[0].axis)).toBeLessThan(2);
  await expect(page.locator('[data-c7="active-title"]')).toContainText("November 2026 → December 2026");
  await expect(page.locator('[data-c7="progress"]')).toContainText("orienting before moves (free)");
  await expect(page.locator('.c7-word-panel:visible')).toHaveCount(0);
  await enterBlocks(page);
  const current=page.locator('[data-c7="active-word"] [aria-current="step"]');
  await expect(current).toHaveCount(1);
  expect(await current.getAttribute("data-block")).toBe("0");
  await page.evaluate(()=>window.c7release());
  for(const theme of ["light","dark"]){
    await page.emulateMedia({colorScheme:theme});
    const ratios=await page.evaluate(()=>{
      const rgb=s=>s.match(/[\d.]+/g).map(Number);
      const lum=c=>{const v=c.slice(0,3).map(x=>{x/=255;return x<=0.04045?x/12.92:((x+0.055)/1.055)**2.4});return .2126*v[0]+.7152*v[1]+.0722*v[2]};
      return [...document.querySelectorAll('[data-c7="active-word"] .c7-current,[data-c7="active-word"] .c7-past,[data-c7="alignment"]')].map(el=>{
        let bg=[255,255,255],opacity=1;
        for(let n=el;n;n=n.parentElement){opacity*=Number(getComputedStyle(n).opacity);const c=rgb(getComputedStyle(n).backgroundColor);if(c.length===3||c[3]===1){bg=c;break}}
        const fg=rgb(getComputedStyle(el).color).map((v,i)=>v*opacity+bg[i]*(1-opacity));
        const [a,b]=[lum(fg),lum(bg)];return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
      });
    });
    expect(ratios.length).toBeGreaterThanOrEqual(3);
    for(const ratio of ratios)expect(ratio,theme).toBeGreaterThanOrEqual(4.5);
  }
  const before=await page.locator('[data-c7="active-word"]').innerHTML();
  await page.locator('[data-c7="orientation"]').selectOption("after");
  await page.locator('[data-c7="notation"]').selectOption("raw");
  await page.locator('[data-c7="slice"]').uncheck();
  expect(await page.locator('[data-c7="active-word"]').innerHTML()).toBe(before);
  await expect(page.locator('[data-c7="active-title"]')).toContainText("Blocks");
  await page.locator('[data-c7="skip"]').click();
  await idle(page,"2026-12");
  await expect(page.locator('[data-c7="active-step"]')).toBeHidden();
  await expect(page.locator('[data-c7="active-word"] [aria-current]')).toHaveCount(0);
  await page.evaluate(()=>window.c7release());
});
test("raw expansions map legal generators to the actual animated block and exclude rotations from move counts",async({page})=>{
  await controlled(page);
  await page.locator('[data-c7="notation"]').selectOption("raw");
  await page.locator('a[data-nav="next"]').click();
  await enterBlocks(page);
  await expect(page.locator('[data-c7="active-note"]')).toContainText("Equivalent expansion");
  const block=await page.evaluate(()=>window.c7turns.at(-1));
  const expected=await page.evaluate(async(b)=>{
    const {expandBlock}=await import('/src/apps/calendar7/blocks.ts');
    return expandBlock(b).map(([g,q])=>`g${g}:${q===1?"+1":q}`);
  },block);
  const tokens=await page.locator('[data-c7="active-word"] [aria-current="step"] .c7-tok').allTextContents();
  expect(tokens.map(t=>t.replace(' (free)',''))).toEqual(expected);
  for(const t of tokens)expect(Number(/^g(\d+):/.exec(t)[1])).toBeLessThanOrEqual(21);
  await expect(page.locator('[data-c7="progress"]')).toContainText("move 1 of");
  await page.locator('[data-c7="skip"]').click();await idle(page,"2026-12");
});
// The longest word of the chain C is March to April 2023 (124 block moves); October to November 2026 is 100 and does not scroll.
test("long prefix words follow only inside their container, preserve focus and clear highlights after interruption",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await controlled(page,"2023&month=3");
  await page.locator('a[data-nav="next"]').click();await enterBlocks(page);
  await page.locator('[data-c7="play"]').click(); // pause while a block is in flight
  await page.evaluate(()=>window.c7release());
  const pausedCount=await page.evaluate(()=>window.c7turns.length);
  await expect(page.locator(ROOT)).toHaveAttribute("data-c7-state","paused");
  expect(await page.evaluate(()=>window.c7turns.length)).toBe(pausedCount);
  await page.locator('[data-c7="play"]').click();
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const ancestors = () => page.evaluate(()=>{const out=[];for(let el=document.querySelector('[data-c7="active-word"]').parentElement;el;el=el.parentElement){const css=getComputedStyle(el);if(el.scrollHeight>el.clientHeight+1&&/auto|scroll/.test(css.overflowY))out.push([el.id||el.className,el.scrollTop,el.scrollLeft])}return out});
  const ancestorOffsets = await ancestors();
  const scroll=await page.evaluate(()=>window.scrollY);
  await page.evaluate(async()=>{
    for(let i=0;i<120;i++){window.c7release();await new Promise(requestAnimationFrame)}
  });
  expect(await page.locator('[data-c7="active-word"]').evaluate(el=>el.scrollTop)).toBeGreaterThan(0);
  expect(await page.evaluate(()=>window.scrollY)).toBe(scroll);
  expect(await ancestors()).toEqual(ancestorOffsets);
  const within=await page.locator('[data-c7="active-word"]').evaluate(el=>{const box=el.getBoundingClientRect(),g=el.querySelector('[aria-current="step"]').getBoundingClientRect();return g.top>=box.top-.5&&g.bottom<=box.bottom+.5});
  expect(within).toBe(true);
  await expect(page.locator('[data-c7="play"]')).toBeFocused();
  expect(await page.locator('[data-c7="active-word"] .c7-past').count()).toBeGreaterThan(100);
  await page.locator('a[data-nav="previous"]').click(); // completes the old plan and replaces it
  await expect(page.locator('[data-c7="active-title"]')).toContainText("April 2023 → March 2023");
  await page.locator('[data-c7="skip"]').click();await idle(page,"2023-03");
  await expect(page.locator('[data-c7="active-word"] [aria-current]')).toHaveCount(0);
});

for (const viewport of [{width:1280,height:1000},{width:900,height:700},{width:390,height:844}]) test(`real November navigation keeps controls, active heading and current group below the cube at ${viewport.width}`,async({page})=>{
  await page.setViewportSize(viewport);
  await page.emulateMedia({reducedMotion:"no-preference"});
  await page.goto('/index.html?app=calendar7&year=2026&month=11');await idle(page,'2026-11');
  await page.locator('[data-c7="speed"]').selectOption('500');
  await page.locator('a[data-nav="next"]').click();
  await page.locator('[data-c7="active-word"] [aria-current="step"]').waitFor();
  const geometry=await page.evaluate(()=>{
    const scene=document.getElementById('studio-scene').getBoundingClientRect();
    const port=document.getElementById('studio-stage').getBoundingClientRect();
    return ['play','skip','orientation','active-title','active-word'].map(name=>{
      const el=name==='active-word'?document.querySelector('[data-c7="active-word"] [aria-current="step"]'):document.querySelector(`[data-c7="${name}"]`);
      const b=el.getBoundingClientRect(),hit=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);
      return {name,top:b.top,bottom:b.bottom,sceneBottom:scene.bottom,portBottom:port.bottom,hit:!!hit&&(el===hit||el.contains(hit)),canvas:!!hit?.closest('#studio-scene')};
    });
  });
  for(const g of geometry){expect(g.top,g.name).toBeGreaterThanOrEqual(g.sceneBottom-.5);expect(g.bottom,g.name).toBeLessThanOrEqual(g.portBottom+.5);expect(g.canvas,g.name).toBe(false);expect(g.hit,g.name).toBe(true)}
  await expect(page.locator('[data-c7="active-title"]')).toBeFocused();
  if(viewport.width===1280) await page.screenshot({path:test.info().outputPath("review-navigation.png")});
  await page.locator('[data-c7="skip"]').click();await idle(page,'2026-12');
});

for (const loading of ["viewer","data"]) test(`all playback selections made while the ${loading} loads are retained by the first step`,async({page})=>{
  let release,reached;
  const held=new Promise(r=>{release=r}),requested=new Promise(r=>{reached=r});
  await page.route(loading==='viewer'?'**/src/apps/calendar7/viewer.ts*':'**/calendar7/chain-c/graph.v1.json*',async route=>{reached();await held;await route.continue()});
  try{
    await page.goto('/index.html?app=calendar7&year=2026&month=11',{waitUntil:'domcontentloaded'});await requested;
    if(loading==='data') {
      // Hidden initial controls can receive browser-restored values before handlers attach.
      await page.evaluate(()=>{for(const [name,value] of Object.entries({orientation:"after",notation:"raw",speed:"500"})) document.querySelector(`[data-c7="${name}"]`).value=value;document.querySelector('[data-c7="slice"]').checked=false});
    } else {
      await page.locator('[data-c7="orientation"]').selectOption('after');
      await page.locator('[data-c7="notation"]').selectOption('raw');
      await page.locator('[data-c7="slice"]').uncheck();
      await page.locator('[data-c7="speed"]').selectOption('500');
    }
    release();await idle(page,'2026-11');
    await expect(page.locator('[data-c7="speed"]')).toHaveValue('500');
    await expect(page.locator('[data-c7="orientation"]')).toHaveValue('after');
    await expect(page.locator('[data-c7="notation"]')).toHaveValue('raw');
    await expect(page.locator('[data-c7="slice"]')).not.toBeChecked();
    await page.emulateMedia({reducedMotion:'no-preference'});
    await page.evaluate(async()=>{const {Calendar7Viewer}=await import('/src/apps/calendar7/viewer.ts');Calendar7Viewer.prototype.turn=()=>new Promise(()=>{})});
    await page.locator('a[data-nav="next"]').click();
    await expect(page.locator(ROOT)).toHaveAttribute('data-c7-phase','blocks');
    await expect(page.locator('[data-c7="active-title"]')).toContainText('Raw generators (equivalent expansion)');
    await expect(page.locator('[data-c7="active-note"]')).toContainText('generators 1–21');
    await expect(page.locator('[data-c7="alignment"]')).toContainText('at the end');
    await page.locator('[data-c7="skip"]').click();await idle(page,'2026-12');
  }finally{release()}
});
