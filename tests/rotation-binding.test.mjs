import test from "node:test";
import assert from "node:assert/strict";
import { Group, Quaternion } from "three";
import { bindSmartRotation, readRotationMode, rotationStorageKey } from "../packages/cube-viewer/src/rotation-binding.ts";
class Element extends EventTarget {
 constructor(tag="canvas"){super();this.tagName=tag;this.children=[];this.style={touchAction:"pan-y"};this.attributes={};this.captures=new Set();}
 append(...values){for(const v of values){this.children.push(v);v.parent=this;}}
 setAttribute(k,v){this.attributes[k]=v;}
 remove(){if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this);}
 setPointerCapture(id){this.captures.add(id);}hasPointerCapture(id){return this.captures.has(id);}releasePointerCapture(id){this.captures.delete(id);}
 pointer(type,x=100,y=100,id=1,pointerType="mouse"){const event=new Event(type);Object.assign(event,{pointerId:id,clientX:x,clientY:y,pointerType});this.dispatchEvent(event);}
}
function harness(saved="smart") {
 let at=0;const element=new Element(),panel=new Element("details"),root=new Group(),document=new EventTarget(),media=new EventTarget();
 document.hidden=false;document.createElement=tag=>new Element(tag);media.matches=false;
 const data=new Map([[rotationStorageKey("/test"),JSON.stringify({version:1,mode:saved})]]);
 const env={now:()=>at,document,media,pathname:"/test",storage:{getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)}};
 const binding=bindSmartRotation(element,root,{sensitivity:.008,threshold:4,panel,environment:env});
 const select=panel.children[0].children[0],note=panel.children[1];
 return{element,panel,root,document,media,env,binding,select,note,data,time(value){at=value;},step(value){at=value;binding.step();}};
}
const same=(a,b)=>assert(a.angleTo(b)<1e-7);
test("production pointerdown interrupts pending/active return before threshold, preserving full displayed quaternion",()=>{
 const h=harness("classic");h.element.pointer("pointerdown");h.time(.2);h.element.pointer("pointermove",170,140);h.time(.4);h.element.pointer("pointerup",170,140);
 h.select.value="smart";h.select.dispatchEvent(new Event("change"));assert.equal(h.binding.controller.phase,"awaiting-return");
 h.step(5.6);assert.equal(h.binding.controller.phase,"returning");const before=h.root.quaternion.clone();
 h.time(5.7);h.element.pointer("pointerdown",170,140);same(h.root.quaternion,before);assert.equal(h.binding.controller.phase,"dragging");
 h.element.pointer("pointermove",171,141);h.step(20);same(h.root.quaternion,before);h.element.pointer("pointercancel",171,141);assert.equal(h.binding.controller.phase,"awaiting-return");
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
 h.element.pointer("pointerup",10,10,2,"touch");assert.equal(h.binding.controller.phase,"awaiting-return");assert.equal(h.binding.controller.returnDeadline,25);h.binding.dispose();
});
test("binding settings persist modes, honor reduced motion, freeze hidden time and release capture/listeners/controls",()=>{
 const h=harness("free");assert.equal(h.select.value,"free");assert.equal(h.select.attributes["aria-label"],"View rotation mode");assert(h.select.attributes["aria-describedby"]);
 h.select.value="classic";h.select.dispatchEvent(new Event("change"));assert.equal(JSON.parse(h.data.get(rotationStorageKey("/test"))).mode,"classic");
 h.element.pointer("pointerdown");h.time(.2);h.element.pointer("pointermove",180,150);h.time(.4);h.element.pointer("pointerup");
 h.select.value="smart";h.select.dispatchEvent(new Event("change"));const q=h.root.quaternion.clone();
 h.time(1);h.document.hidden=true;h.document.dispatchEvent(new Event("visibilitychange"));h.step(100);same(h.root.quaternion,q);
 h.document.hidden=false;h.document.dispatchEvent(new Event("visibilitychange"));assert.equal(h.binding.controller.returnDeadline,105);
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
 h.select.value="smart";h.select.dispatchEvent(new Event("change"));h.step(5.6);assert.equal(h.binding.controller.phase,"returning");const q=h.root.quaternion.clone();
 h.time(5.7);const key=new Event("keydown",{cancelable:true});h.panel.dispatchEvent(key);assert.equal(key.defaultPrevented,false);same(h.root.quaternion,q);assert.equal(h.binding.controller.phase,"awaiting-return");assert.equal(h.binding.controller.returnDeadline,10.7);
 h.time(6);h.panel.dispatchEvent(new Event("input"));assert.equal(h.binding.controller.returnDeadline,11);
 h.binding.dispose();h.time(10);h.panel.dispatchEvent(new Event("pointerdown"));same(h.root.quaternion,q);assert.equal(h.binding.controller.phase,"idle");
});
