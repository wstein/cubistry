// Run from the feature checkout with its installed Playwright dependency.
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {readFileSync,writeFileSync} from 'node:fs';
const {chromium}=createRequire(resolve('package.json'))('@playwright/test');
const d=JSON.parse(readFileSync(new URL('./optimized-runtime.json',import.meta.url)));
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
 const page=await browser.newPage({viewport:{width:1280,height:1000},reducedMotion:'no-preference'});
 await page.goto(process.env.BENCHMARK_URL||'http://127.0.0.1:5186/');
 await page.waitForFunction(()=>!document.querySelector('#application').disabled);
 const result=await page.evaluate(async d=>{
  const C=await import('/packages/cube-core/src/index.ts'),M=await import('/packages/cube-mechanics/src/index.ts'),A=await import('/packages/cube-assets/src/index.ts'),V=await import('/packages/cube-viewer/src/index.ts'),D=await import('/src/apps/counter/design.ts');
  const base=await D.loadCounterDesign();
  const print=C.validatePrint({schema:'cubistry.print',version:1,id:'five_second_benchmark',topology:{kind:'cube',size:2},cubies:Array.from({length:8},(_,id)=>({id,position:d.printing.find(s=>s.cubie===id).p})),stickers:d.printing.map(s=>({id:s.id,cubie:s.cubie,normal:s.n,up:s.up,assetId:s.image,materialId:'sticker',equivalentQuarterTurns:[0]}))});
  const assets=await A.loadAssets(A.validateAssets({...base.assets,fonts:[],documents:[],images:base.assets.images.filter(i=>/^[0-9]$/.test(i.id))},[print]),[print]);
  const host=document.createElement('div');host.style='width:800px;height:700px';document.body.append(host);const viewer=new V.CubeViewer(host);
  const tick=d.increments.findIndex(w=>w.split(' ').length===d.maximumHTM);
  let state=M.applyMoves(M.initialState(print),M.parseAlg(d.zeroWord));for(let i=0;i<tick;i++)state=M.applyMoves(state,M.parseAlg(d.increments[i]));
  const observations=[];
  for(const duration of [250,250,250,2000]){
   viewer.configure(print,state,assets);viewer.setAnimationSpeed(V.BASE_MOVE_DURATION_MS/duration);const start=performance.now(),moves=[];let current=state;
   for(const move of M.parseAlg(d.increments[tick])){const p=M.presentMove(current,move),began=performance.now();await viewer.animate(p);if(!C.stateEquals(viewer.presentedState,p.to))throw Error('Viewer failed commit');moves.push({move,milliseconds:performance.now()-began,to:p.to});current=p.to;}
   observations.push({durationPerMove:duration,milliseconds:performance.now()-start,moves});
  }
  viewer.destroy();assets.dispose();host.remove();return {tickFrom:tick,word:d.increments[tick],print,start:state,observations,userAgent:navigator.userAgent,viewport:[1280,1000],reducedMotion:false};
 },d);
 writeFileSync(process.argv[2],JSON.stringify({sourceFeatureCommit:'39cb33ba730ddf4b66b1a52c67fc0f220ae43a21',renderer:'Chromium SwiftShader software rendering; local observations, no hardware guarantee',...result},null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify(result.observations.map(o=>({durationPerMove:o.durationPerMove,milliseconds:o.milliseconds,committedHTM:o.moves.length}))));
} finally {await browser.close();}
