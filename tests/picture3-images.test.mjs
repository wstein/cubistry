import test from "node:test";
import assert from "node:assert/strict";
import { PNG } from "pngjs";
import { rasterDimensions, cropRectangle, validateCrop, decodePhoto, PhotoDecoder, paintFace } from "../src/apps/picture3/images.ts";
const png = (width = 12, height = 8) => new Blob([PNG.sync.write(new PNG({ width, height }))], { type: "image/png" });
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
test("crop coverage is bounded and reversible for wide/portrait images and extreme keyboard positions", () => {
  for (const [w,h] of [[1536,768],[768,1536],[768,768]]) for (const zoom of [1,2,4]) for (const x of [-1,0,1]) for (const y of [-1,0,1]) {
    const [left,top,edge,edge2] = cropRectangle(w,h,{zoom,x,y});
    assert.equal(edge,edge2); assert(edge>0 && left>=0 && top>=0 && left+edge<=w && top+edge<=h);
    assert.equal(edge,Math.min(w,h)/zoom);
  }
  for (const crop of [{zoom:0,x:0,y:0},{zoom:1,x:Infinity,y:0},{zoom:5,x:0,y:0},{zoom:1,x:0,y:2}]) assert.throws(() => validateCrop(crop));
});
test("raster headers are checked before decode; source and decoded pixel bombs close safely", async () => {
  assert.deepEqual(rasterDimensions(new Uint8Array(await png().arrayBuffer()),"image/png"),[12,8]);
  const bad = new Uint8Array(await png().arrayBuffer()); new DataView(bad.buffer).setUint32(16,9000);
  let calls=0;
  await assert.rejects(decodePhoto(new Blob([bad],{type:"image/png"}),async()=>{calls++;}),/megapixels/);
  await assert.rejects(decodePhoto(new Blob(["<svg/>"],{type:"image/svg+xml"}),async()=>{calls++;}),/SVG/);
  await assert.rejects(decodePhoto(new Blob(["wrong"],{type:"image/jpeg"}),async()=>{calls++;}),/supported/);
  assert.equal(calls,0);
  let closed=0;
  await assert.rejects(decodePhoto(png(),async()=>({width:9000,height:1,close(){closed++;}})),/megapixels/);
  assert.equal(closed,1);
  await assert.rejects(decodePhoto(png(),async()=>{throw Error("decode failed");}),/decode failed/);
  let options;
  const image=await decodePhoto(png(),async(_,o)=>(options=o,{width:12,height:8,close(){}}));
  assert.equal(options.imageOrientation,"from-image"); assert.equal(options.resizeHeight,undefined);
  image.close();
});
test("face painting splits the full image into nine unmirrored rows and columns", () => {
  const draws=[];
  const canvas=(width,height)=>({width,height,getContext:()=>({clearRect(){},drawImage(...args){draws.push(args);}})});
  const face=canvas(768,768), tiles=Array.from({length:9},()=>canvas(256,256)), source={width:1200,height:800};
  paintFace(source,{zoom:2,x:1,y:-1},face,tiles);
  assert.deepEqual(draws[0],[source,800,0,400,400,0,0,768,768]);
  tiles.forEach((tile,i)=>assert.deepEqual(draws[i+1],[face,(i%3)*256,Math.floor(i/3)*256,256,256,0,0,256,256]));
});
test("serialized decode rejects stale results, survives failures and closes pending work on disposal", async () => {
  const first=deferred(), started=deferred(); let calls=0, closed=0;
  const decoder=new PhotoDecoder(async()=>{calls++; if(calls===1){started.resolve();await first.promise;} return {width:12,height:8,close(){closed++;}};});
  const a=decoder.load("F",png()); await started.promise;
  const b=decoder.load("F",png()); first.resolve();
  assert.equal(await a,null); const latest=await b; assert(latest); assert.equal(closed,1); latest.close();
  const pending=deferred(), began=deferred();
  const dying=new PhotoDecoder(async()=>{began.resolve();await pending.promise;return {width:12,height:8,close(){closed++;}};});
  const job=dying.load("U",png()); await began.promise; dying.dispose();pending.resolve();assert.equal(await job,null);
  assert.equal(closed,3);
  await assert.rejects(dying.load("U",png()),/closed/);
  let count=0; const retry=new PhotoDecoder(async()=>{if(++count===1)throw Error("decode failed");return{width:12,height:8,close(){}};});
  await assert.rejects(retry.load("D",png()),/decode failed/); assert(await retry.load("D",png())); retry.dispose();decoder.dispose();
});

test("JPEG SOF and all supported WebP headers preserve known dimensions and reject corrupt/truncated inputs", () => {
  for (const marker of [0xc0,0xc2]) {
    const jpeg=new Uint8Array([255,216,255,224,0,4,0,0,255,marker,0,17,8,0,123,1,65,3,1,17,0,2,17,0,3,17,0,255,217]);
    assert.deepEqual(rasterDimensions(jpeg,"image/jpeg"),[321,123]);
    assert.throws(()=>rasterDimensions(jpeg.subarray(0,16),"image/jpeg"),/Truncated|supported/);
  }
  for(const kind of ["VP8 ","VP8L","VP8X"]) {
    const bytes=new Uint8Array(30),view=new DataView(bytes.buffer);bytes.set(new TextEncoder().encode("RIFF"),0);bytes.set(new TextEncoder().encode("WEBP"),8);bytes.set(new TextEncoder().encode(kind),12);
    if(kind==="VP8 "){bytes.set([157,1,42],23);view.setUint16(26,321,true);view.setUint16(28,123,true);}
    if(kind==="VP8L"){bytes[20]=47;bytes[21]=64;bytes[22]=129;bytes[23]=30;}
    if(kind==="VP8X"){bytes[24]=64;bytes[25]=1;bytes[27]=122;}
    assert.deepEqual(rasterDimensions(bytes,"image/webp"),[321,123]);
    assert.throws(()=>rasterDimensions(bytes.subarray(0,20),"image/webp"),/supported/);
    bytes[0]=0;assert.throws(()=>rasterDimensions(bytes,"image/webp"),/supported/);
  }
});
test("postdecode resize refusal closes its image and obsolete failures do not override newer uploads",async()=>{
  let closed=0;await assert.rejects(decodePhoto(png(),async()=>({width:1537,height:1,close(){closed++;}})),/safely resize/);assert.equal(closed,1);
  const pending=deferred(),began=deferred();let count=0;
  const decoder=new PhotoDecoder(async()=>{if(++count===1){began.resolve();await pending.promise;throw Error("obsolete decode");}return{width:12,height:8,close(){}};});
  const old=decoder.load("F",png());await began.promise;const current=decoder.load("F",png());pending.resolve();assert.equal(await old,null);assert(await current);decoder.dispose();
});
