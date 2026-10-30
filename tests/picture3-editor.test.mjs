import test from "node:test";
import assert from "node:assert/strict";
import { PictureEditor } from "../src/apps/picture3/editor.ts";
import { PhotoDecoder } from "../src/apps/picture3/images.ts";
import { FACE_FRAMES } from "../src/apps/picture3/model.ts";
import { PNG } from "pngjs";
const blob=()=>new Blob([PNG.sync.write(new PNG({width:12,height:8}))],{type:"image/png"});
const sources=()=>Object.fromEntries(FACE_FRAMES.map(f=>[f.face,{blob:blob(),crop:{zoom:1,x:0,y:0}}]));
const canvas=size=>({width:size,height:size,getContext:()=>({clearRect(){},drawImage(){},fillRect(){}})});
const deferred=()=>{let resolve;const promise=new Promise(yes=>resolve=yes);return{promise,resolve};};
test("set replacement is atomic, failed decode retains current pictures/crops, and disposal closes every bitmap",async()=>{
 let count=0,closed=0,failAt=Infinity;
 const decoder=new PhotoDecoder(async()=>{if(++count===failAt)throw Error("bad image");return{width:12,height:8,close(){closed++;}};});
 const editor=new PictureEditor({decoder,canvas});await editor.load(sources());assert(editor.ready);
 editor.crop("B",{zoom:2,x:.5,y:-.5});const before=editor.snapshot(),old=editor.faces.get("B");
 failAt=count+3;await assert.rejects(editor.load(sources()),/bad image/);
 assert.equal(editor.faces.get("B"),old);assert.deepEqual(editor.snapshot().B.crop,before.B.crop);assert.equal(closed,2);
 await assert.rejects(editor.upload("U",new Blob(["<svg/>"],{type:"image/svg+xml"})),/PNG/);
 assert.equal(editor.faces.get("B"),old);
 const tile=editor.artwork("picture").get(3),source=editor.faces.get("U").source;
 editor.crop("U",{zoom:2,x:1,y:-1});assert.equal(editor.artwork("picture").get(3),tile);assert.equal(editor.faces.get("U").source,source);
 editor.dispose();assert.equal(closed,8);assert.equal(old.canvas.width,0);
});
test("late upload/set/preset work cannot replace a newer choice or leak a decoded image",async()=>{
 let wait=null,began=null,closed=0;
 const decoder=new PhotoDecoder(async()=>{if(wait){began.resolve();await wait.promise;}return{width:12,height:8,close(){closed++;}};});
 const editor=new PictureEditor({decoder,canvas,rasterize:async()=>blob()});await editor.load(sources());
 wait=deferred();began=deferred();const upload=editor.upload("F",blob());await began.promise;
 const newest=sources();newest.B.crop={zoom:3,x:0,y:1};const load=editor.load(newest);wait.resolve();wait=null;
 assert.equal(await upload,false);assert.equal(await load,true);assert.deepEqual(editor.snapshot().B.crop,newest.B.crop);
 assert.equal(closed,7);editor.dispose();assert.equal(closed,13);
 const gate=deferred(), start=deferred();let calls=0;
 const presetEditor=new PictureEditor({decoder:new PhotoDecoder(async()=>({width:12,height:8,close(){}})),canvas,
   rasterize:async()=>{if(++calls===1){start.resolve();await gate.promise;}return blob();}});
 const oldPreset=presetEditor.preset("coast");await start.promise;
 assert(await presetEditor.load(sources()));gate.resolve();assert.equal(await oldPreset,false);presetEditor.dispose();
});
