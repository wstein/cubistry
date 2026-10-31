import test from "node:test";
import assert from "node:assert/strict";
import { Quaternion } from "three";
import { bindSmartRotation, readRotationMode, rotationStorageKey } from "../packages/cube-viewer/src/rotation-binding.ts";
import { returnDelay } from "../packages/cube-viewer/src/smart-rotation.ts";
import { rotationHarness } from "./helpers/rotation-harness.mjs";
const harness = (mode="smart") => rotationHarness({mode});
const same=(a,b)=>assert(a.angleTo(b)<1e-7);
const wait=h=>returnDelay(h.binding.controller.quaternion.angleTo(h.binding.controller.anchor));
const close=(a,b)=>assert(Math.abs(a-b)<1e-9,`${a} != ${b}`);
test("production pointerdown interrupts pending/active return before threshold, preserving full displayed quaternion",()=>{
 const h=harness("classic");h.element.pointer("pointerdown");h.time(.2);h.element.pointer("pointermove",250,200);h.time(.4);h.element.pointer("pointerup",250,200);
 h.select.value="smart";h.select.dispatchEvent(new Event("change"));assert.equal(h.binding.controller.phase,"awaiting-return");assert.match(h.note.textContent,/short wait/);
 const dl=h.binding.controller.returnDeadline;h.step(dl+.05);assert.equal(h.binding.controller.phase,"returning");const before=h.root.quaternion.clone();
 h.time(dl+.1);h.element.pointer("pointerdown",250,200);same(h.root.quaternion,before);assert.equal(h.binding.controller.phase,"dragging");
 h.element.pointer("pointermove",251,201);h.step(20);h.element.pointer("pointercancel",251,201);assert.equal(h.binding.controller.phase,"awaiting-return");
 assert.equal(h.element.captures.size,0);h.binding.dispose();
});
test("touch overlap blocks automatic motion until every contact ends; active deadzone reversal remains exact",()=>{
 const h=harness("classic"),start=h.root.quaternion.clone();
 h.element.pointer("pointerdown",100,100,1,"touch");h.time(.1);h.element.pointer("pointermove",130,120,1,"touch");h.time(.2);h.element.pointer("pointermove",100,100,1,"touch");same(h.root.quaternion,start);
 h.element.pointer("pointerup",100,100,1,"touch");
 h.select.value="smart";h.select.dispatchEvent(new Event("change"));
 h.time(1);h.element.pointer("pointerdown",100,100,1,"touch");h.time(1.2);h.element.pointer("pointermove",180,150,1,"touch");
 h.time(1.3);h.element.pointer("pointerdown",10,10,2,"touch");const held=h.root.quaternion.clone();h.element.pointer("pointermove",230,230,1,"touch");same(h.root.quaternion,held);
 h.element.pointer("pointerup",180,150,1,"touch");h.step(20);assert.equal(h.binding.controller.phase,"dragging");same(h.root.quaternion,held);
 h.element.pointer("pointerup",10,10,2,"touch");assert.equal(h.binding.controller.phase,"awaiting-return");close(h.binding.controller.returnDeadline,20+wait(h));h.binding.dispose();
});
test("binding settings persist modes, honor reduced motion, freeze hidden time and release capture/listeners/controls",()=>{
 const h=harness("free");assert.equal(h.select.value,"free");assert.equal(h.select.attributes["aria-label"],"View rotation mode");assert(h.select.attributes["aria-describedby"]);
 h.select.value="classic";h.select.dispatchEvent(new Event("change"));assert.equal(JSON.parse(h.data.get(rotationStorageKey("/test"))).mode,"classic");
 h.element.pointer("pointerdown");h.time(.2);h.element.pointer("pointermove",180,150);h.time(.4);h.element.pointer("pointerup");
 h.select.value="smart";h.select.dispatchEvent(new Event("change"));const q=h.root.quaternion.clone();
 h.time(1);h.document.hidden=true;h.document.dispatchEvent(new Event("visibilitychange"));h.step(100);same(h.root.quaternion,q);
 h.document.hidden=false;h.document.dispatchEvent(new Event("visibilitychange"));close(h.binding.controller.returnDeadline,100+wait(h));
 h.media.matches=true;h.media.dispatchEvent(new Event("change"));assert.equal(h.binding.controller.phase,"idle");assert.match(h.note.textContent,/Reduced motion/);h.step(200);same(h.root.quaternion,q);
 h.time(201);h.element.pointer("pointerdown");assert.equal(h.element.captures.size,1);h.binding.dispose();assert.equal(h.element.captures.size,0);assert.equal(h.panel.children.length,0);assert.equal(h.element.style.touchAction,"pan-y");
 h.element.pointer("pointermove",300,300);h.media.matches=false;h.media.dispatchEvent(new Event("change"));h.document.dispatchEvent(new Event("visibilitychange"));h.step(300);same(h.root.quaternion,q);
});
test("motion preference failures are bounded and safe; zoom/reset never reconstruct a partial orientation",()=>{
 for(const raw of ["broken","null",JSON.stringify({version:1,mode:"wrong"}),JSON.stringify({version:2,mode:"free"}),"x".repeat(257)])assert.equal(readRotationMode({getItem:()=>raw},"k"),"smart");
 assert.equal(readRotationMode({getItem(){throw Error("denied");}},"k"),"smart");assert(rotationStorageKey("x".repeat(1000)).length<240);
 const h=harness();h.env.storage.setItem=()=>{throw Error("quota");};h.select.value="free";h.select.dispatchEvent(new Event("change"));assert.equal(h.binding.controller.mode,"free");
 h.element.pointer("pointerdown");h.time(.1);h.element.pointer("pointermove",160,130);h.element.pointer("pointerup");h.step(.2);const q=h.root.quaternion.clone();h.binding.interact();same(h.root.quaternion,q);assert.equal(h.binding.controller.phase,"idle");
 h.binding.reset();same(h.root.quaternion,new Quaternion());same(h.binding.controller.anchor,new Quaternion());h.binding.dispose();
});

test("shared settings pointer/keyboard/input activity freezes return without intercepting native controls and cleans up",()=>{
 const h=harness("classic");h.element.pointer("pointerdown");h.time(.2);h.element.pointer("pointermove",190,160);h.time(.4);h.element.pointer("pointerup");
 h.select.value="smart";h.select.dispatchEvent(new Event("change"));const dl=h.binding.controller.returnDeadline;h.step(dl+.05);assert.equal(h.binding.controller.phase,"returning");const q=h.root.quaternion.clone();
 h.time(dl+.1);const key=new Event("keydown",{cancelable:true});h.panel.dispatchEvent(key);assert.equal(key.defaultPrevented,false);same(h.root.quaternion,q);assert.equal(h.binding.controller.phase,"awaiting-return");close(h.binding.controller.returnDeadline,dl+.1+wait(h));
 h.time(dl+.5);h.panel.dispatchEvent(new Event("input"));close(h.binding.controller.returnDeadline,dl+.5+wait(h));
 h.binding.dispose();h.time(10);h.panel.dispatchEvent(new Event("pointerdown"));same(h.root.quaternion,q);assert.equal(h.binding.controller.phase,"idle");
});

test("capture failure aborts the uncaptured contact and leaves later gestures usable",()=>{
 const h=harness("classic"),capture=h.element.setPointerCapture;
 h.element.setPointerCapture=()=>{throw Error("capture unavailable");};
 h.element.pointer("pointerdown",100,100,1);assert.notEqual(h.binding.controller.phase,"dragging");
 // Its outside pointerup is deliberately never delivered.
 h.element.setPointerCapture=capture;const before=h.root.quaternion.clone();
 h.time(1);h.element.pointer("pointerdown",100,100,2);h.time(1.1);h.element.pointer("pointermove",140,120,2);h.element.pointer("pointerup",140,120,2);
 assert(h.root.quaternion.angleTo(before)>.1);assert.equal(h.element.captures.size,0);assert.notEqual(h.binding.controller.phase,"dragging");
 h.binding.dispose();
});

test('held settings pointers freeze explicit leveling across outside releases, overlap, lost contact and blur without blocking native controls',()=>{
 const h=harness('free');h.element.pointer('pointerdown');h.time(.1);h.element.pointer('pointermove',170,140);h.time(.2);h.element.pointer('pointermove',140,190);h.time(.4);h.element.pointer('pointerup');
 h.time(1);h.select.value='smart';h.select.dispatchEvent(new Event('change'));h.step(1.4);assert.equal(h.binding.controller.phase,'leveling');
 const event=(type,id)=>{const e=new Event(type,{cancelable:true});Object.assign(e,{pointerId:id});return e;};
 const q=h.root.quaternion.clone();const down=event('pointerdown',4);h.panel.dispatchEvent(down);assert.equal(down.defaultPrevented,false);
 h.step(8);same(h.root.quaternion,q);assert.equal(h.binding.controller.phase,'dragging');
 h.element.pointer('pointerdown',100,100,5);h.time(8.1);h.element.pointer('pointermove',200,200,5);same(h.root.quaternion,q);
 h.document.dispatchEvent(event('pointerup',4));h.step(9);same(h.root.quaternion,q);assert.equal(h.binding.controller.phase,'dragging');
 h.element.pointer('pointerup',200,200,5);assert.equal(h.binding.controller.phase,'leveling');h.step(9.2);
 h.panel.dispatchEvent(event('pointerdown',6));h.panel.dispatchEvent(event('pointerdown',7));const held=h.root.quaternion.clone();
 h.document.dispatchEvent(event('pointercancel',6));h.step(12);same(h.root.quaternion,held);h.document.dispatchEvent(event('lostpointercapture',7));assert.equal(h.binding.controller.phase,'leveling');
 h.step(12.2);h.panel.dispatchEvent(event('pointerdown',8));const beforeBlur=h.root.quaternion.clone();h.window.dispatchEvent(new Event('blur'));h.step(100);same(h.root.quaternion,beforeBlur);
 h.window.dispatchEvent(new Event('focus'));assert.equal(h.binding.controller.phase,'leveling');h.step(101);assert.notEqual(h.binding.controller.phase,'dragging');
 h.binding.dispose();const final=h.root.quaternion.clone();h.panel.dispatchEvent(event('pointerdown',9));h.window.dispatchEvent(new Event('blur'));h.document.dispatchEvent(event('pointerup',9));h.step(200);same(h.root.quaternion,final);
});
