// SPDX-License-Identifier: AGPL-3.0-or-later
import { test, expect } from "@playwright/test";
const ROOT="#calendar7-root";
const idle=(page,month)=>expect(page.locator(ROOT)).toHaveAttribute("data-c7-month",month,{timeout:30000});
async function controlled(page, ym="2028&month=1") {
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
  await expect(page.locator('[data-c7="active-title"]')).toContainText("January 2028 → February 2028");
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
  await idle(page,"2028-02");
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
  await page.locator('[data-c7="skip"]').click();await idle(page,"2028-02");
});
test("long seam words follow only inside their container, preserve focus and clear highlights after interruption",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await controlled(page,"2027&month=12");
  await page.locator('a[data-nav="next"]').click();await enterBlocks(page);
  await page.locator('[data-c7="play"]').click(); // pause while a block is in flight
  await page.evaluate(()=>window.c7release());
  const pausedCount=await page.evaluate(()=>window.c7turns.length);
  await expect(page.locator(ROOT)).toHaveAttribute("data-c7-state","paused");
  expect(await page.evaluate(()=>window.c7turns.length)).toBe(pausedCount);
  await page.locator('[data-c7="play"]').click();
  const scroll=await page.evaluate(()=>window.scrollY);
  await page.evaluate(async()=>{
    for(let i=0;i<120;i++){window.c7release();await new Promise(requestAnimationFrame)}
  });
  expect(await page.locator('[data-c7="active-word"]').evaluate(el=>el.scrollTop)).toBeGreaterThan(0);
  expect(await page.evaluate(()=>window.scrollY)).toBe(scroll);
  await expect(page.locator('[data-c7="play"]')).toBeFocused();
  expect(await page.locator('[data-c7="active-word"] .c7-past').count()).toBeGreaterThan(100);
  await page.locator('a[data-nav="previous"]').click(); // completes the old plan and replaces it
  await expect(page.locator('[data-c7="active-title"]')).toContainText("January 2028 → December 2027");
  await page.locator('[data-c7="skip"]').click();await idle(page,"2027-12");
  await expect(page.locator('[data-c7="active-word"] [aria-current]')).toHaveCount(0);
});
