import{a as e,d as t,h as n,i as r,n as i,r as ee,s as a}from"./model-d7f7Vv9Y.js";import{t as o}from"./controller-BF7_OZcC.js";var s=[`0`,`false`,`off`,`no`],c=[`design`,`padding`,`date`,`live`,`decrement`,`increment`].map(e=>`calendar-${e}`);function l(e){let t=(e.get(`lang`)||e.get(`language`)||e.get(`design`)||``).toLowerCase();return t===`en`||t===`en-3`||t===`english`?`en-3`:`de-a`}function u(e,t){return e===`de-a`?`de-a`:t?`en-3-zero`:`en-3-unpadded`}var te=`
  <div class="hud-header">
    <h2 class="hud-title">Date</h2>
    <div class="hud-actions">
      <button type="button" class="hud-btn icon-only hud-toggle-btn" title="Minimize or expand controls">─</button>
    </div>
  </div>
  <div class="hud-body calendar-controls">
    <output id="calendar-digital" aria-label="Requested calendar date">—</output>
    <p id="calendar-zone" class="small"></p>
    <label for="calendar-design">Physical print</label>
    <select id="calendar-design" disabled>
      <option value="de-a">Deutsch · A</option>
      <option value="en-3">English · 3</option>
    </select>
    <p id="calendar-layout" class="small"></p>
    <label id="calendar-padding-label" hidden><input id="calendar-padding" type="checkbox" checked /> Leading zero</label>
    <label for="calendar-date">Inspect a date</label>
    <input type="date" id="calendar-date" min="0001-01-01" max="9999-12-31" disabled />
    <div class="calendar-day-buttons">
      <button id="calendar-decrement" aria-label="Previous day" disabled>−1 day</button>
      <button id="calendar-increment" aria-label="Next day" disabled>+1 day</button>
    </div>
    <p id="calendar-estimates" class="small" aria-label="Day transition move estimates"></p>
    <button id="calendar-live" class="primary" disabled>Today</button>
    <div class="calendar-move-counts">
      <span>Transition moves</span>
      <output id="calendar-moves" aria-label="Physical transition move progress">0 / 0 HTM · 0 / 0 cube rotations</output>
      <p id="calendar-route" class="small">Initial display</p>
      <p id="calendar-queue" class="small"></p>
    </div>
    <label for="calendar-speed">Rotation Speed</label>
    <select id="calendar-speed">
      <option value="500">500 ms</option>
      <option value="250" selected>250 ms</option>
      <option value="100">100 ms</option>
      <option value="50">50 ms</option>
      <option value="10">10 ms</option>
    </select>
    <p class="small sr-only">Drag to look around. Date changes follow legal turns, including whole-cube rotations. The fixed stickers never change.</p>
  </div>
  <p id="calendar-error" class="error" role="alert"></p>`,ne=`
  <div id="calendar-viewer" aria-busy="true"></div>
  <div id="calendar-front" class="sr-only" aria-label="Committed calendar face"></div>
  <p id="calendar-state" role="status">Preparing the fixed print…</p>`;async function d(d,f,re,p){let{isCurrent:m}=re,h=!1,g=!0,_=!1,v=!1,y=``,b=a(p.now()),x=null,S=null,C=null,w=new Map,T=[],E=()=>!h&&m(),D=l(f),O=null;try{await p.fontsReady()}catch(e){O=e}if(!m())return;d.innerHTML=ne,p.controls.innerHTML=te;let k=e=>p.controls.querySelector(`#${e}`)??d.querySelector(`#${e}`),A=k(`calendar-design`),j=k(`calendar-padding`),M=k(`calendar-date`),N=k(`calendar-live`);A.value=D;let P=f.get(`padding`)??f.get(`pad`);P!==null&&(j.checked=!s.includes(P.toLowerCase()));let F=f.get(`date`);if(F&&F!==`today`)try{b=i(F),g=!1}catch{}M.value=b.iso;let I=()=>A.value===`de-a`?`de-a`:`en-3`,L=()=>u(I(),j.checked),ie=()=>I()===`de-a`?`de-DE`:`en-GB`,R=(e,t)=>{k(e).textContent=t};async function z(e){let t=w.get(e);if(t)return t;let r=n(await p.loadDesign(e));return w.set(e,r),r}function B(e){v=!0,_=!1,R(`calendar-error`,e?.message??`Calendar failed`),R(`calendar-state`,`Calendar stopped. Reload to recover.`);for(let e of c)k(e).disabled=!0}function ae(){if(!x||!C)return;let e=x.progress;if(R(`calendar-moves`,e.planning?`Planning legal route…`:`${e.completed.htm} / ${e.total.htm} HTM · ${e.completed.rotations} / ${e.total.rotations} cube rotations`),k(`calendar-moves`).dataset.route=e.route,k(`calendar-moves`).dataset.solverStatus=C.solverStatus,R(`calendar-route`,e.planning?`Finding a shorter legal route…`:e.route===`optimized`?`Optimized physical route`:e.route===`fallback`?`Verified baseline route (shorter route unavailable)`:`Initial display`),R(`calendar-queue`,e.queued?`Latest requested date is queued.`:``),!_)return R(`calendar-estimates`,`Preparing move estimates…`);if(x.busy)return R(`calendar-estimates`,`Day estimates available after motion.`);let n=w.get(L());if(!n)return R(`calendar-estimates`,`Preparing move estimates…`);let i=e=>{try{let i=x.estimate(r(n,t(b,e)));return i?`${i.htm} HTM + ${i.rotations} cube rotations`:`Calculated when selected`}catch{return`Date limit`}};R(`calendar-estimates`,`−1 day: ${i(-1)} · +1 day: ${i(1)}`)}function V(){let e=I()===`en-3`;k(`calendar-padding-label`).hidden=!e,R(`calendar-layout`,e?`Weekday · Month · Day. Adjacent day digits.`:`Wochentag · Tag · Monat. Two-letter weekday, left-aligned.`),A.disabled=!_||!!x?.busy,j.disabled=!_,M.disabled=!_,N.disabled=!_,N.setAttribute(`aria-pressed`,String(g)),k(`calendar-decrement`).disabled=!_||b.iso===`0001-01-01`,k(`calendar-increment`).disabled=!_||b.iso===`9999-12-31`,ae()}function H(t,n,r){if(E()){if(r)return B(r);k(`calendar-viewer`).setAttribute(`aria-busy`,String(n)),R(`calendar-state`,n?x?.progress.planning?`Planning legal date route…`:`Updating · physical date in motion`:g?`Live · local date`:`Selected date`),!n&&S?.presentedState&&R(`calendar-front`,e(S.presentedState).map(e=>e.image||`blank`).join(` · `)),V()}}function U(){let e=new Date(0);e.setUTCFullYear(b.year,b.month-1,b.day),R(`calendar-digital`,new Intl.DateTimeFormat(ie(),{day:`2-digit`,month:`short`,year:`numeric`,timeZone:`UTC`}).format(e)),R(`calendar-zone`,Intl.DateTimeFormat().resolvedOptions().timeZone+(g?` · Live`:` · Inspecting`))}async function W(){if(_&&!v&&E())try{let e=L(),t=e+`/`+b.iso;if(U(),t===y)return H(x.current,x.busy);y=t;let n=await z(e);if(!E()||!_||t!==y)return;x.request(r(n,b)),V()}catch(e){E()&&B(e)}}let oe={configure:(e,t)=>S.configure(e,t),animate:async(e,t,n)=>{ee(E(),`Calendar closed`),await S.animate(e,t,n)}};async function G(){_=!1,y=``,V();try{let e=await z(L());if(!E())return;x=new o(e,r(e,b),oe,H,C.plan),p.expose(`__calendarController`,x),_=!0,U(),y=L()+`/`+b.iso,H(x.current,!1),V(),p.setPrintDesign(I())}catch(e){E()&&B(e)}}function K(){if(_&&!v)try{let e=i(M.value);R(`calendar-error`,``),b=e,g=!1,W(),V()}catch(e){R(`calendar-error`,e.message)}}function q(e){if(_&&!v)try{b=t(b,e),g=!1,M.value=b.iso,R(`calendar-error`,``),W(),V()}catch(e){R(`calendar-error`,e.message)}}let J=(e,t,n)=>{let r=k(e);r.addEventListener(t,n),T.push(()=>r.removeEventListener(t,n))};J(`calendar-design`,`change`,()=>{A.disabled=!0,G()}),J(`calendar-padding`,`change`,()=>void W()),J(`calendar-date`,`change`,K),J(`calendar-date`,`keydown`,e=>{e.key===`Enter`&&(e.preventDefault(),K())}),J(`calendar-decrement`,`click`,()=>q(-1)),J(`calendar-increment`,`click`,()=>q(1)),J(`calendar-live`,`click`,()=>{R(`calendar-error`,``),g=!0,b=a(p.now()),M.value=b.iso,W(),V()}),J(`calendar-speed`,`change`,()=>{S&&(S.duration=Number(k(`calendar-speed`).value))});let Y=p.controls.querySelector(`.hud-toggle-btn`),X=()=>{p.controls.classList.toggle(`is-minimized`),Y&&(Y.textContent=p.controls.classList.contains(`is-minimized`)?`⚙`:`─`)};Y?.addEventListener(`click`,X),T.push(()=>Y?.removeEventListener(`click`,X));function Z(){if(!_||!g||v||!E())return;let e=a(p.now());e.iso!==b.iso&&(b=e,M.value=b.iso,W())}let se=()=>{for(let e of T.splice(0))e()},Q=()=>{if(h)return;h=!0,se(),C?.dispose(),p.expose(`__calendarController`,void 0),p.expose(`__calendarViewer`,void 0);let e=()=>{if(S){if(S.animating)return p.later(e,50);S.destroy(),S=null}};e()},$={dispose:Q,resetCamera:()=>{h||S?.resetReferenceView()}};if(O)return B(O),$;if(C=p.createOptimizer(),S=p.createViewer(k(`calendar-viewer`)),p.expose(`__calendarViewer`,S),await G(),!m())Q();else return T.push(p.every(Z,1e3),p.onResume(Z)),$}export{d as mountCalendar,l as printOf,u as runtimeId};