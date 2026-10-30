import { Group } from "three";
import { bindSmartRotation, rotationStorageKey } from "../../packages/cube-viewer/src/rotation-binding.ts";
export class Element extends EventTarget {
 constructor(tag="canvas"){super();this.tagName=tag;this.children=[];this.style={touchAction:"pan-y"};this.attributes={};this.captures=new Set();}
 append(...values){for(const v of values){this.children.push(v);v.parent=this;}}
 setAttribute(k,v){this.attributes[k]=v;}
 remove(){if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this);}
 setPointerCapture(id){this.captures.add(id);}hasPointerCapture(id){return this.captures.has(id);}releasePointerCapture(id){this.captures.delete(id);}
 pointer(type,x=100,y=100,id=1,pointerType="mouse"){const event=new Event(type);Object.assign(event,{pointerId:id,clientX:x,clientY:y,pointerType});this.dispatchEvent(event);}
}
export function rotationHarness({mode="smart",root=new Group(),initial,sensitivity=.008,threshold=4}={}) {
 let at=0;const element=new Element(),panel=new Element("details"),document=new EventTarget(),media=new EventTarget();
 if(initial)root.quaternion.copy(initial);
 document.hidden=false;document.createElement=tag=>new Element(tag);media.matches=false;
 const data=new Map([[rotationStorageKey("/test"),JSON.stringify({version:1,mode})]]);
 const env={now:()=>at,document,media,pathname:"/test",storage:{getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)}};
 const binding=bindSmartRotation(element,root,{sensitivity,threshold,panel,environment:env});
 const select=panel.children[0].children[0],note=panel.children[1];
 return{element,panel,root,document,media,env,binding,select,note,data,time(value){at=value;},step(value){at=value;binding.step();}};
}
