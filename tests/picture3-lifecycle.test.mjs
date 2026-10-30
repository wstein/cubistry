import test from "node:test";
import assert from "node:assert/strict";
import { bindPictureLifecycle } from "../src/apps/picture3/lifecycle.ts";
import { PictureEditor } from "../src/apps/picture3/editor.ts";
import { PhotoDecoder } from "../src/apps/picture3/images.ts";
import { Cube3Controller } from "../src/apps/picture3/controller.ts";
import { FACE_FRAMES, sameState } from "../src/apps/picture3/model.ts";
import { PNG } from "pngjs";
test("cached Back/Forward pages retain usable unsaved pictures/crops and scramble; permanent navigation releases once",async()=>{
 const target=new EventTarget(),sources=Object.fromEntries(FACE_FRAMES.map(f=>[f.face,{blob:new Blob([PNG.sync.write(new PNG({width:8,height:8}))],{type:"image/png"}),crop:{zoom:1,x:0,y:0}}]));
 let closed=0,suspended=0,resumed=0,disposed=0;
 const editor=new PictureEditor({decoder:new PhotoDecoder(async()=>({width:8,height:8,close(){closed++;}})),
 canvas:size=>({width:size,height:size,getContext:()=>({clearRect(){},drawImage(){}})})});
 await editor.load(sources);editor.crop("B",{zoom:2,x:.5,y:-.5});
 const view={configure(){},async animate(){}},solver={cancel(){},dispose(){},async solve(){return "";}};
 const controller=new Cube3Controller(view,()=>editor.artwork("picture"),()=>{},solver);await controller.play("R U2");
 const state=controller.snapshot.state,face=editor.faces.get("B"),crop=editor.snapshot().B.crop;
 const unbind=bindPictureLifecycle(target,{suspend(){suspended++;},resume(){resumed++;},dispose(){disposed++;controller.dispose();editor.dispose();}});
 const event=(name,persisted)=>{const e=new Event(name);Object.defineProperty(e,"persisted",{value:persisted});target.dispatchEvent(e);};
 event("pagehide",true);event("pageshow",true);
 assert.equal(suspended,1);assert.equal(resumed,1);assert.equal(disposed,0);assert.equal(closed,0);
 assert.equal(editor.faces.get("B"),face);assert.deepEqual(editor.snapshot().B.crop,crop);assert(sameState(controller.snapshot.state,state));
 editor.crop("B",{zoom:3,x:0,y:0});await controller.play("F");assert.equal(controller.snapshot.cursor,3);
 event("pagehide",false);event("pagehide",false);event("pageshow",true);
 assert.equal(disposed,1);assert.equal(closed,6);assert.equal(face.canvas.width,0);assert.equal(resumed,1);unbind();
});
