// SPDX-License-Identifier: AGPL-3.0-or-later
/** Structural DOM for exercising the real month-picker event controller in Node. */
export function pickerDom() {
  const docEvents = new Map(), hostEvents = new Map(), focus = [];
  const body={children:[],appendChild(node){this.children.push(node);node.parentNode=this;}};
  const doc={activeElement:null,defaultView:null,body,querySelectorAll(){return this.focusables??[];},addEventListener(t,f){docEvents.set(t,f);},removeEventListener(t,f){if(docEvents.get(t)===f)docEvents.delete(t);}};
  const el=(attrs={},zone="dialog")=>({attrs:{...attrs},zone,inside:true,disabled:false,hidden:false,value:"",style:{},tabIndex:0,events:new Map(),setAttribute(k,v){this.attrs[k]=String(v);},getAttribute(k){return this.attrs[k]??null;},hasAttribute(k){return Object.hasOwn(this.attrs,k);},removeAttribute(k){delete this.attrs[k];},getClientRects(){return[{}];},focus(){doc.activeElement=this;focus.push(this);},closest(){return this;},addEventListener(t,f){this.events.set(t,f);},removeEventListener(t,f){if(this.events.get(t)===f)this.events.delete(t);},remove(){if(this.parentNode){this.parentNode.children=this.parentNode.children.filter(n=>n!==this);this.parentNode=null;}}});
  const trigger=el({},"host"),label=el({},"host"),input=el({"data-c7-picker-year":""}),dialog=el();
  dialog.contains=x=>Boolean(x?.inside&&x.zone==="dialog");dialog.querySelector=sel=>sel.includes("data-c7-picker-year")?(dialog.html?.includes("data-c7-picker-year")?input:null):el({"role":"gridcell"});dialog.querySelectorAll=()=>dialog.tabbables??[];
  let paintHook=null;Object.defineProperty(dialog,"innerHTML",{get(){return this.html||"";},set(v){this.html=v;paintHook?.();}});
  const host={ownerDocument:doc,innerHTML:"",contains:x=>Boolean(x?.inside&&x.zone==="host"),querySelector(sel){return sel.includes("trigger")?trigger:sel.includes("popup")?dialog:label;},addEventListener(t,f){hostEvents.set(t,f);},removeEventListener(t,f){if(hostEvents.get(t)===f)hostEvents.delete(t);}};
  const event=(target,extra={})=>({target,prevented:false,preventDefault(){this.prevented=true;},...extra});
  const click=(name,value)=>{const target=el({"data-c7-picker-action":name,"data-value":String(value??0)},name==="toggle"?"host":"dialog");const e=event(target);(name==="toggle"?hostEvents:dialog.events).get("click")?.(e);return e;};
  return {host,label,hostEvents,docEvents,doc,trigger,dialog,input,focus,click,event,el,setPaintHook:h=>paintHook=h};
}
