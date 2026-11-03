import"./modulepreload-polyfill-B5Qt9EMX.js";import{i as nt}from"./hud-idle-DOw3sxRr.js";import{C as G}from"./stage-DvgqEptG.js";import{C as st,L as K,c as ot,f as it}from"./statistics-pIZlGFip.js";import{H as N,h as B}from"./hsm-source-ChCaHlc1.js";import{h as Q,t as at,r as rt,l as W,a as X,M as Y,b as ct}from"./tenth-BfCxUuxA.js";import"./presentation-rotation-p-13F4z1.js";import{l as lt}from"./index-wNaGm7IV.js";import{p as ut,O as Z,W as dt,F as mt,f as pt,m as tt}from"./clock-AsFyA-WC.js";import{l as gt,C as ht,a as vt,b as ft,T as bt,c as yt,h as St}from"./blank-top-CfzMXfVB.js";import{P as kt,M as wt,a as Ct}from"./timer-Bx3TmPAW.js";import{l as et}from"./design-Be1HVdsh.js";import{C as $,B as D}from"./index-me5JM1fm.js";import"./three-BW9MzyAf.js";import"./playback-c5TypXwO.js";import"./index-C1wZ9l11.js";import"./puzlwerk-2x2-CtNdqoX_.js";const Mt=[{id:"plastic",color:"#202329",roughness:.45},{id:"sticker",color:"#ffffff",roughness:.7}];function xt(e="dseg7",i="off",n="same",c="words-pascal",l=[],a=[],u=[],s=[]){const d=rt(n,e),m=Q(c,d),h=at(e,i,l),o=Q("words-pascal",d).find(r=>r.id==="T"),v=o?h.map(r=>r.id==="T"?o:r):h,f=l.filter(r=>!/^[0-9]$/.test(r.id)&&r.id!=="blank"&&r.id!=="T"),g=[...v,...f,...m.filter(r=>["H","M","S"].includes(r.id))],p=Array.from(new Map(g.map(r=>[r.id,r])).values());return{schema:"cubistry.assets",version:1,fonts:a,materials:s&&s.length>0?s:Mt,documents:u,images:p}}nt();const t=e=>document.getElementById(e),x="/cubistry/",j={clock:{title:"Live H–M–S Clock",subtitle:"One current time. Three physical cubes (Hours · Minutes · Seconds).",count:3,badge:"H · M · S"},"ms-timer":{title:"M/S Timer & Stopwatch",subtitle:"Minutes, seconds, and tenth-second precision timer.",count:3,badge:"Min · Sec · 1/10s"},"hm-clock":{title:"H–M Wall Clock",subtitle:"Two physical cubes for hours and minutes.",count:2,badge:"H · M"},tenth:{title:"1/10-Second Counter",subtitle:"Fast single-cube tenth-second counter (0–9).",count:1,badge:"1/10 Sec (0–9)"},counter:{title:"Counter 0–99",subtitle:"Certified 2-digit twisty puzzle counter.",count:1,badge:"0–99 Counter"},timer:{title:"60-Minute Workshop Timer",subtitle:"Physical countdown with real-time settlement.",count:1,badge:"60-Min Timer"},"five-second-timer":{title:"5-Second Precision Timer",subtitle:"5-second countdown with verified route.",count:1,badge:"5-Sec Timer"},"hsm-counter":{title:"H/M/S Counter 00–59",subtitle:"Single-cube 00–59 counter with H, M, S unit stickers.",count:1,badge:"H/M/S (00–59)"},"ms-counter":{title:"M/S Counter 00–59",subtitle:"Single-cube 00–59 counter with min / sec stickers.",count:1,badge:"M/S (00–59)"},"hm-one-cube":{title:"H/M One-Cube Counter",subtitle:"Single physical cube with hours and minutes.",count:1,badge:"H/M One-Cube"}};let k=localStorage.getItem("cubistry_digit_font")||"noto-sans",w=localStorage.getItem("cubistry_marker_mode")||"line-auto",C=localStorage.getItem("cubistry_letter_font")||"same",M=localStorage.getItem("cubistry_lettering")||"words-pascal",q=null,A=null,S=null,H=null;async function Lt(){return H||(H=await et(void 0,x)),H}function E(e,i,n,c="words-pascal"){return xt(e,i,n,c,H?.assets?.images??[],H?.assets?.fonts??[],H?.assets?.documents??[],H?.assets?.materials??[])}const U=(e,i,n)=>lt(e,i,n,x);function I(e,i){const n=e.querySelector(".cube-appearance");if(!n||n.querySelector("#studio-display-font"))return;const c=document.createElement("div");c.className="studio-appearance-fields",c.style.marginTop="8px",c.style.display="flex",c.style.flexDirection="column",c.style.gap="6px";const l=document.createElement("label");l.textContent="Display font";const a=document.createElement("select");a.id="studio-display-font",a.innerHTML=`
    <option value="dseg7">7-Segment (DSEG7)</option>
    <option value="dseg14">14-Segment (DSEG14)</option>
    <option value="noto-sans">Noto Sans (Calendar Standard)</option>
    <option value="quicksand">Quicksand (Rounded Geometric)</option>
    <option value="outfit">Outfit (Clean Geometric)</option>
    <option value="classic">Classic (Geometric)</option>
  `,a.value=k,l.append(a);const u=document.createElement("label");u.textContent="Letter font";const s=document.createElement("select");s.id="studio-letter-font",s.innerHTML=`
    <option value="same">Same as display font</option>
    <option value="dseg7">7-Segment (DSEG7)</option>
    <option value="dseg14">14-Segment (DSEG14)</option>
    <option value="noto-sans">Noto Sans (Calendar Standard)</option>
    <option value="quicksand">Quicksand (Rounded Geometric)</option>
    <option value="outfit">Outfit (Clean Geometric)</option>
    <option value="classic">Classic (Geometric)</option>
  `,s.value=C,u.append(s);const d=document.createElement("label");d.textContent="Orientation marker";const m=document.createElement("select");m.id="studio-marker-mode",m.innerHTML=`
    <option value="off">Off (clean stickers)</option>
    <option value="line-auto">Thin underline (6 / 9 only)</option>
    <option value="line-all">Thin underline (all digits)</option>
    <option value="dot-auto">Dot: Auto (0, 2, 5, 6, 8, 9)</option>
    <option value="dot-all">Dot: All digits (0–9)</option>
  `,m.value=w,d.append(m),c.append(l,u,d),n.append(c);let h=!1;const o=async()=>{if(!h){h=!0;try{k=a.value,C=s.value,w=m.value,localStorage.setItem("cubistry_digit_font",k),localStorage.setItem("cubistry_letter_font",C),localStorage.setItem("cubistry_marker_mode",w);const v=E(k,w,C,M);await i(v)}catch(v){console.warn("Appearance update queued or deferred:",v)}finally{h=!1}}};a.addEventListener("change",o),s.addEventListener("change",o),m.addEventListener("change",o)}function P(e,i){const n=t("studio-controls"),c=n.classList.contains("is-minimized");n.innerHTML=`
    <div class="hud-header">
      <h2 class="hud-title">${e}</h2>
      <div class="hud-actions">
        <button type="button" class="hud-btn icon-only hud-toggle-btn" title="Minimize or expand controls">${c?"⚙":"─"}</button>
      </div>
    </div>
    <div class="hud-body">
      ${i}
    </div>
  `;const l=n.querySelector(".hud-toggle-btn");l?.addEventListener("click",()=>{n.classList.toggle("is-minimized"),l.textContent=n.classList.contains("is-minimized")?"⚙":"─"})}document.querySelector("#presentation-btn, .island-presentation-btn")?.addEventListener("click",()=>R(!0));let _=null;function R(e){const i=typeof e=="boolean"?e:!document.body.classList.contains("presentation-mode");document.body.classList.toggle("presentation-mode",i),i?(document.body.classList.add("show-exit-btn"),clearTimeout(_),_=setTimeout(()=>{document.body.classList.remove("show-exit-btn")},2500),document.documentElement.requestFullscreen&&!document.fullscreenElement&&document.documentElement.requestFullscreen().catch(()=>{})):(document.body.classList.remove("show-exit-btn"),document.fullscreenElement&&document.exitFullscreen&&document.exitFullscreen().catch(()=>{})),q?.resetCamera?.(),A?.resetCamera?.()}window.addEventListener("mousemove",()=>{document.body.classList.contains("presentation-mode")&&(document.body.classList.add("show-exit-btn"),clearTimeout(_),_=setTimeout(()=>{document.body.classList.remove("show-exit-btn")},2500))});document.addEventListener("fullscreenchange",()=>{!document.fullscreenElement&&document.body.classList.contains("presentation-mode")&&R(!1)});t("exit-presentation-btn")?.addEventListener("click",()=>R(!1));window.addEventListener("keydown",e=>{e.key==="Escape"&&document.body.classList.contains("presentation-mode")&&R(!1)});async function Et(){const e=t("studio-cards");e.setAttribute("data-count","3"),e.innerHTML=`
    <article class="clock-card">
      <h2>Hours</h2>
      <div id="clock-hours" data-unit="H" aria-busy="true"></div>
      <p id="hours-state" class="clock-state" role="status">Preparing…</p>
    </article>
    <article class="clock-card">
      <h2>Minutes</h2>
      <div id="clock-minutes" data-unit="M" aria-busy="true"></div>
      <p id="minutes-state" class="clock-state" role="status">Preparing…</p>
    </article>
    <article class="clock-card">
      <h2>Seconds</h2>
      <div id="clock-seconds" data-unit="S" aria-busy="true"></div>
      <p id="seconds-state" class="clock-state" role="status">Preparing…</p>
    </article>
  `,P("Live Time",`
    <div class="clock-digital">
      <output id="clock-digital" aria-label="Current local time">--:--:--</output>
      <span id="clock-status" class="small" role="status">Preparing…</span>
    </div>
    <label for="clock-lettering">Sticker lettering</label>
    <select id="clock-lettering">
      <option value="symbols">Large H / M / S</option>
      <option value="words-pascal" selected>Small Hour / Min / Sec</option>
      <option value="words">Small hour / min / sec</option>
    </select>
    <section class="clock-stats" role="status" aria-label="Clock moves" style="margin-top: 16px;">
      <table class="clock-move-table">
        <caption>Committed moves this session</caption>
        <thead>
          <tr>
            <th scope="col">Cube</th>
            <th scope="col">Total HTM</th>
            <th scope="col">Rotations</th>
            <th scope="col">Last</th>
            <th scope="col">Max</th>
            <th scope="col">Average</th>
          </tr>
        </thead>
        <tbody>
          <tr data-unit="H">
            <th scope="row">Hours</th>
            <td id="hours-session-moves">0</td>
            <td id="hours-session-rotations">0</td>
            <td id="hours-last-moves">—</td>
            <td id="hours-max-moves">—</td>
            <td id="hours-mean-moves">—</td>
          </tr>
          <tr data-unit="M">
            <th scope="row">Minutes</th>
            <td id="minutes-session-moves">0</td>
            <td id="minutes-session-rotations">0</td>
            <td id="minutes-last-moves">—</td>
            <td id="minutes-max-moves">—</td>
            <td id="minutes-mean-moves">—</td>
          </tr>
          <tr data-unit="S">
            <th scope="row">Seconds</th>
            <td id="seconds-session-moves">0</td>
            <td id="seconds-session-rotations">0</td>
            <td id="seconds-last-moves">—</td>
            <td id="seconds-max-moves">—</td>
            <td id="seconds-mean-moves">—</td>
          </tr>
        </tbody>
      </table>
      <button id="reset-clock-moves" class="quiet clock-stats-reset" type="button" style="margin-top: 8px;">
        Reset session moves
      </button>
    </section>
  `),t("clock-lettering").value=M;const i=new G(t("studio-scene"),3);q=i;const n=["hours","minutes","seconds"],c=[new Date().getHours(),new Date().getMinutes(),new Date().getSeconds()],l={hours:500,minutes:250,seconds:100},a=await W(x,B.runtimeSHA256),u=new st(n.length),s=new K;let d=-1;function m(){const g=u.snapshot();if(g.revision===d)return;d=g.revision;const p=(r,y,b=L=>String(L))=>{const L=t(r);L&&(L.textContent=y===null?"—":b(y))};g.units.forEach((r,y)=>{const b=n[y];p(b+"-session-moves",r.session.htm),p(b+"-session-rotations",r.session.rotations),p(b+"-last-moves",r.last),p(b+"-max-moves",r.max),p(b+"-mean-moves",r.mean,it)})}const h=[],o=[];for(let g=0;g<3;g++){const p=i.createCube(t("clock-"+n[g]),g),r=l[n[g]],y=T=>p.setAnimationSpeed(D/T,"quarter-turn");y(r);const b=E(k,w,C,M),L=new N(p,a,{printDefinition:a.printDefinition,name:n[g],assets:b,onMoveCommitted:T=>u.recordMove(g,T),onRotationCommitted:T=>u.recordRotation(g,T)});await L.configure(c[g]),h.push(L),o.push({controller:L,duration:r,setDuration:y})}I(i.appearancePanel,async g=>{await Promise.all(h.map(p=>p.updateManifest(g)))}),t("clock-lettering").addEventListener("change",async()=>{M=t("clock-lettering").value,localStorage.setItem("cubistry_lettering",M);const g=E(k,w,C,M);await Promise.all(h.map(p=>p.updateManifest(g)))}),t("reset-clock-moves")?.addEventListener("click",()=>{u.reset(),m()});function v(){try{const g=Date.now(),p=performance.now(),r=s.tick(g,p,o);u.closeTick(),m();const y=t("clock-digital");y&&(y.textContent=ot(r.values));const b=t("clock-status");b&&(b.textContent=r.motion.includes("synchronizing")?"Synchronizing to current time":"Live · local time"),o.forEach((L,T)=>{const F=t(n[T]+"-state");if(F){const O=r.motion[T];F.dataset.state=O,F.textContent=`${String(L.controller.currentValue).padStart(2,"0")}${O==="idle"?"":O==="moving"?" · Moving":" · Synchronizing"}`}})}catch(g){console.error(g)}}const f=setInterval(v,100);return v(),()=>{clearInterval(f),i.destroy()}}async function Tt(){const e=t("studio-cards");e.setAttribute("data-count","3"),e.innerHTML=`
    <article class="clock-card">
      <h2>Minutes (min)</h2>
      <div id="ms-minutes" data-unit="M" aria-busy="true"></div>
      <p id="ms-minutes-state" class="clock-state" role="status">Preparing…</p>
    </article>
    <article class="clock-card">
      <h2>Seconds (sec)</h2>
      <div id="ms-seconds" data-unit="S" aria-busy="true"></div>
      <p id="ms-seconds-state" class="clock-state" role="status">Preparing…</p>
    </article>
    <article class="clock-card">
      <h2>1/10 Second (1/10)</h2>
      <div id="ms-tenths" data-unit="T" aria-busy="true"></div>
      <p id="ms-tenths-state" class="clock-state" role="status">Preparing…</p>
    </article>
  `,P("M/S Timer",`
    <div class="timer-controls">
      <label for="timer-mode">Mode</label>
      <select id="timer-mode">
        <option value="countdown">Countdown</option>
        <option value="stopwatch">Stopwatch</option>
      </select>
      <form id="timer-duration-form">
        <div id="timer-duration-setting">
          <label for="timer-duration">Duration MM:SS.d</label>
          <div class="duration-actions" style="display: flex; gap: 8px;">
            <input id="timer-duration" type="text" value="15:00.0" autocomplete="off" style="flex: 1;" />
            <button id="timer-set" type="submit">Set</button>
          </div>
        </div>
      </form>
      <p id="timer-bounds" class="small">00:00.0–59:59.0 · tenth-second steps</p>
      <output id="timer-logical" class="studio-digital-huge">15:00.0</output>
      <div class="timer-actions" style="display: flex; gap: 8px;">
        <button id="timer-start" class="primary" type="button">Start</button>
        <button id="timer-reset" type="button">Reset</button>
      </div>
      <p id="timer-sync" class="small timer-motion" role="status" style="margin-top: 12px;">
        <span id="timer-motion-label">Idle</span><br />
        <span id="timer-effective" class="small"></span>
      </p>
    </div>
  `);const i=new G(t("studio-scene"),3);q=i;const n=await X(x,tt.runtimeSHA256);let c=E(k,w,C,"words-pascal");const l={major:i.createCube(t("ms-minutes"),0),minor:i.createCube(t("ms-seconds"),1),tenth:i.createCube(t("ms-tenths"),2)},a=p=>r=>l[p]?.setAnimationSpeed(D/r);let u=null,s=null;const d=(p,r)=>y=>{const b=new Ct(r,n.print,c,p,y,U);return p==="M"&&(u=b),p==="S"&&(s=b),b},m=new kt({minorModulus:60,majorModulus:60,createMinor:d("S",l.minor),createMajor:d("M",l.major),onState:()=>f()}),h=new Y(l.tenth,c,()=>f(),U),o=new wt({pair:m,tenth:h,preferred:()=>100,setDuration:{minor:a("minor"),major:a("major"),tenth:a("tenth")},refresh:()=>v()});I(i.appearancePanel,async p=>{await Promise.all([u?.updateManifest(p),s?.updateManifest(p),h?.updateManifest(p)])});function v(){o.tick(),f()}function f(){if(!o)return;const p=!o.running&&!o.busy;t("timer-logical").textContent=o.text,t("ms-minutes-state").textContent=`${String(m.major.currentValue).padStart(2,"0")}${m.major.busy?" · Moving":""}`,t("ms-seconds-state").textContent=`${String(m.minor.currentValue).padStart(2,"0")}${m.minor.busy?" · Moving":""}`,t("ms-tenths-state").textContent=`.${h.currentValue}${h.busy?" · Moving":""}`,t("timer-start").textContent=o.running?"Pause":"Start",t("timer-mode").disabled=!p,t("timer-duration").disabled=o.running,t("timer-set").disabled=o.running,t("timer-reset").disabled=o.running,t("timer-duration-setting").hidden=o.mode==="stopwatch";const r=o.busy?"Moving / Synchronizing":o.running?"Running":"Idle";t("timer-motion-label").textContent=r}t("timer-start").addEventListener("click",()=>{o.running?o.pause():o.start(),f()}),t("timer-reset").addEventListener("click",()=>{o.reset(),f()}),t("timer-mode").addEventListener("change",()=>{o.setMode(t("timer-mode").value),f()}),t("timer-duration-form").addEventListener("submit",p=>{p.preventDefault();const r=ut(t("timer-duration").value);r!==null&&(o.configure(r),f())}),await Promise.all([m.configure(Z.defaultSeconds),h.configure(0)]),a("minor")(100),a("major")(250),a("tenth")(50),f();const g=setInterval(v,50);return()=>{clearInterval(g),i.destroy()}}async function Ht(){const e=t("studio-cards");e.setAttribute("data-count","2"),e.innerHTML=`
    <article class="clock-card">
      <h2>Hours</h2>
      <div id="clock-hours" data-unit="H" aria-busy="true"></div>
      <p id="hours-state" class="clock-state" role="status">Preparing…</p>
    </article>
    <article class="clock-card">
      <h2>Minutes</h2>
      <div id="clock-minutes" data-unit="M" aria-busy="true"></div>
      <p id="minutes-state" class="clock-state" role="status">Preparing…</p>
    </article>
  `,P("Live Wall Time",`
    <div class="clock-digital">
      <output id="clock-digital" class="studio-digital-huge" aria-label="Current local time">--:--</output>
      <span id="clock-status" class="small" role="status">Synchronizing…</span>
    </div>
    <label for="clock-lettering">Sticker lettering</label>
    <select id="clock-lettering">
      <option value="symbols">Large H / M</option>
      <option value="words-pascal" selected>Small Hour / Min</option>
      <option value="words">Small hour / min</option>
    </select>
  `),t("clock-lettering").value=M;const i=new G(t("studio-scene"),2);q=i;const n=["hours","minutes"],c=[new Date().getHours(),new Date().getMinutes()],l={hours:500,minutes:250},a=await W(x,B.runtimeSHA256),u=new K,s=[],d=[];for(let o=0;o<2;o++){const v=i.createCube(t("clock-"+n[o]),o),f=l[n[o]],g=y=>v.setAnimationSpeed(D/y,"quarter-turn");g(f);const p=E(k,w,C,M),r=new N(v,a,{printDefinition:a.printDefinition,name:n[o],assets:p});await r.configure(c[o]),s.push(r),d.push({controller:r,duration:f,setDuration:g})}I(i.appearancePanel,async o=>{await Promise.all(s.map(v=>v.updateManifest(o)))}),t("clock-lettering").addEventListener("change",async()=>{M=t("clock-lettering").value,localStorage.setItem("cubistry_lettering",M);const o=E(k,w,C,M);await Promise.all(s.map(v=>v.updateManifest(o)))});function m(){try{const o=Date.now(),v=performance.now(),f=u.tick(o,v,d),g=t("clock-digital");g&&(g.textContent=`${String(f.values[0]).padStart(2,"0")}:${String(f.values[1]).padStart(2,"0")}`),d.forEach((p,r)=>{const y=t(n[r]+"-state");if(y){const b=f.motion[r];y.dataset.state=b,y.textContent=`${String(p.controller.currentValue).padStart(2,"0")}${b==="idle"?"":" · Moving"}`}})}catch(o){console.error(o)}}const h=setInterval(m,100);return m(),()=>{clearInterval(h),i.destroy()}}async function Dt(){const e=t("studio-cards");e.setAttribute("data-count","1"),e.innerHTML=`
    <article class="clock-card" style="text-align: center;">
      <h2>Tenth-Second Display</h2>
      <output id="tenth-value-display" class="studio-digital-huge" style="display: block;">.0</output>
      <p id="tenth-state" class="clock-state" role="status">Ready</p>
    </article>
  `,P("1/10-Second Counter",`
    <p class="small">Period-1 {L, D, B} sequence with fast responsive stepping.</p>
    <div class="tenth-quick-grid">
      ${[0,1,2,3,4,5,6,7,8,9].map(s=>`<button class="tenth-quick-btn" data-val="${s}">${s}</button>`).join("")}
    </div>
    <div class="tenth-step-actions">
      <button id="tenth-step-minus5">-5 Steps</button>
      <button id="tenth-step-plus5">+5 Steps</button>
    </div>
    <div class="tenth-toggle-row">
      <label for="tenth-speed-select">Step speed</label>
      <select id="tenth-speed-select">
        <option value="50">50 ms (Fast)</option>
        <option value="100" selected>100 ms (Default)</option>
        <option value="250">250 ms</option>
        <option value="500">500 ms</option>
      </select>
    </div>
    <div class="tenth-toggle-row" style="margin-top: 8px;">
      <label for="tenth-direction-toggle">Direction</label>
      <select id="tenth-direction-toggle">
        <option value="1" selected>Forward (+1)</option>
        <option value="-1">Reverse (-1)</option>
      </select>
    </div>
  `);const i=new $(t("studio-scene"));A=i;let n=E(k,w,C,"words-pascal"),c=100,l=1;function a(s){const d=ct(s);i.setAnimationSpeed(D/d)}a(c);const u=new Y(i,n,(s,d,m)=>{t("tenth-value-display").textContent=`.${s}`,t("tenth-state").textContent=d?"Moving…":"Ready",m&&console.error(m)},U);return I(t("studio-scene"),async s=>{await u.updateManifest(s)}),await u.configure(0),controlsContainer.querySelectorAll(".tenth-quick-btn").forEach(s=>{s.addEventListener("click",()=>{u.stepTo(Number(s.dataset.val),l)})}),t("tenth-step-plus5").addEventListener("click",()=>{u.stepBy(5*l)}),t("tenth-step-minus5").addEventListener("click",()=>{u.stepBy(-5*l)}),t("tenth-speed-select").addEventListener("change",s=>{c=Number(s.target.value),a(c)}),t("tenth-direction-toggle").addEventListener("change",s=>{l=Number(s.target.value)}),()=>{i.destroy()}}async function It(){const e=t("studio-cards");e.setAttribute("data-count","1"),e.innerHTML=`
    <article class="clock-card" style="text-align: center;">
      <h2>Counter Value</h2>
      <output id="counter-value-display" class="studio-digital-huge" style="display: block;">00</output>
      <p id="counter-state" class="clock-state" role="status">Ready</p>
    </article>
  `,P("Counter Controls",`
    <div style="display: flex; gap: 8px; margin: 12px 0;">
      <button id="counter-minus-10" style="flex: 1;">-10</button>
      <button id="counter-minus-1" style="flex: 1;">-1</button>
      <button id="counter-plus-1" style="flex: 1;">+1</button>
      <button id="counter-plus-10" style="flex: 1;">+10</button>
    </div>
    <div style="display: flex; gap: 8px;">
      <button id="counter-reset" style="flex: 1;">Reset (0)</button>
    </div>
    <div style="margin-top: 16px;">
      <label>
        <input type="checkbox" id="counter-auto-step" />
        Auto step (+1 every second)
      </label>
    </div>
  `);const i=new $(t("studio-scene"));A=i,i.setAnimationSpeed(D/100);const[n,c]=await Promise.all([et(void 0,x),gt(x)]);let l=E(k,w,C);const a=new ht(i,n,{certified:c,assets:l,onState:(d,m)=>{t("counter-value-display").textContent=String(d).padStart(2,"0"),t("counter-state").textContent=m?"Turning…":"Ready"}});I(t("studio-scene"),async d=>{await a.updateManifest(d)}),await a.configure(0);const u=d=>{const h=(a.currentValue+d+100)%100;a.request(h)};t("counter-plus-1").addEventListener("click",()=>u(1)),t("counter-minus-1").addEventListener("click",()=>u(-1)),t("counter-plus-10").addEventListener("click",()=>u(10)),t("counter-minus-10").addEventListener("click",()=>u(-10)),t("counter-reset").addEventListener("click",()=>a.request(0));let s=null;return t("counter-auto-step").addEventListener("change",d=>{d.target.checked?s=setInterval(()=>u(1),1e3):(clearInterval(s),s=null)}),()=>{s&&clearInterval(s),i.destroy()}}async function J(e=!1){const i=t("studio-cards");i.setAttribute("data-count","1"),i.innerHTML=`
    <article class="clock-card" style="text-align: center;">
      <h2>${e?"5-Second Countdown":"60-Minute Countdown"}</h2>
      <output id="timer-display" class="studio-digital-huge" style="display: block;">
        ${e?"00:05.0":"15:00"}
      </output>
      <p id="timer-state" class="clock-state" role="status">Ready</p>
    </article>
  `,P(e?"5-Second Timer":"Workshop Timer",`
    <div style="display: flex; gap: 8px; margin: 12px 0;">
      <button id="timer-toggle-btn" class="primary" style="flex: 1;">Start</button>
      <button id="timer-reset-btn" style="flex: 1;">Reset</button>
    </div>
    <p id="timer-status-info" class="small">Idle · Tap Start to countdown</p>
  `);const n=new $(t("studio-scene"));A=n,n.setAnimationSpeed(D/100);const c=e?await vt(x):await ft(x),l=e?mt:Z,a=new dt(void 0,l);let u=E(k,w,C);const s=new bt(n,c,{assets:u,onState:(o,v)=>{t("timer-state").textContent=v?"Moving…":"Ready"}});I(t("studio-scene"),async o=>{await s.updateManifest(o)});const d=e?5:900;await s.configure(d);function m(){const o=a.snapshot();t("timer-display").textContent=pt(o.bucket,l.maxSeconds),t("timer-toggle-btn").textContent=a.running?"Pause":"Start",t("timer-status-info").textContent=a.running?"Counting down…":"Paused"}t("timer-toggle-btn").addEventListener("click",()=>{a.running?a.pause():a.start(),m()}),t("timer-reset-btn").addEventListener("click",()=>{a.reset(),s.request(d),m()}),m();const h=setInterval(m,100);return()=>{clearInterval(h),n.destroy()}}async function z(e="hsm"){const i=t("studio-cards");i.setAttribute("data-count","1"),i.innerHTML=`
    <article class="clock-card" style="text-align: center;">
      <h2 id="single-hsm-title">Counter 00–59</h2>
      <output id="hsm-value-display" class="studio-digital-huge" style="display: block;">00</output>
      <p id="hsm-state" class="clock-state" role="status">Ready</p>
    </article>
  `,P("Counter Controls",`
    <div style="margin-bottom: 12px;">
      <label for="single-unit-select">Unit sticker</label>
      <select id="single-unit-select">
        ${e==="hsm"?`
          <option value="H">Hour (H)</option>
          <option value="M" selected>Minute (M)</option>
          <option value="S">Second (S)</option>
        `:e==="ms"?`
          <option value="M" selected>Minute (min)</option>
          <option value="S">Second (sec)</option>
        `:`
          <option value="H">Hour (H)</option>
          <option value="M" selected>Minute (M)</option>
        `}
      </select>
    </div>
    <div style="display: flex; gap: 8px; margin: 12px 0;">
      <button id="hsm-minus-10" style="flex: 1;">-10</button>
      <button id="hsm-minus-1" style="flex: 1;">-1</button>
      <button id="hsm-plus-1" style="flex: 1;">+1</button>
      <button id="hsm-plus-10" style="flex: 1;">+10</button>
    </div>
    <div style="display: flex; gap: 8px;">
      <button id="hsm-reset" style="flex: 1;">Reset (00)</button>
    </div>
  `);const n=new $(t("studio-scene"));A=n,n.setAnimationSpeed(D/100);const c=e==="ms"?await X(x,tt.runtimeSHA256):e==="hm"?await yt(x,St.runtimeSHA256):await W(x,B.runtimeSHA256);let l=E(k,w,C,M);const a=new N(n,c,{printDefinition:c.printDefinition,name:"unit",assets:l,onState:(s,d)=>{t("hsm-value-display").textContent=String(s).padStart(2,"0"),t("hsm-state").textContent=d?"Turning…":"Ready"}});I(t("studio-scene"),async s=>{await a.updateManifest(s)}),await a.configure(0);const u=s=>{const m=(a.currentValue+s+60)%60;a.request(m)};return t("hsm-plus-1").addEventListener("click",()=>u(1)),t("hsm-minus-1").addEventListener("click",()=>u(-1)),t("hsm-plus-10").addEventListener("click",()=>u(10)),t("hsm-minus-10").addEventListener("click",()=>u(-10)),t("hsm-reset").addEventListener("click",()=>a.request(0)),()=>{n.destroy()}}async function V(e,i=!0){if(j[e]||(e="clock"),S){try{S()}catch(c){console.warn("Cleanup error:",c)}S=null}t("studio-scene").innerHTML="",t("studio-cards").innerHTML="",t("studio-controls").innerHTML="",t("studio-error").textContent="";const n=j[e];if(t("studio-heading").textContent=n.title,t("studio-subtitle").textContent=n.subtitle,t("studio-cube-count-badge").textContent=`${n.count} CUBE${n.count>1?"S":""}`,t("studio-mode-label").textContent=n.badge,t("studio-application").value=e,i){const c=new URL(location.href);c.searchParams.set("mode",e),history.replaceState(null,"",c),localStorage.setItem("cubistry_chronocube_mode",e)}try{e==="clock"?S=await Et():e==="ms-timer"?S=await Tt():e==="hm-clock"?S=await Ht():e==="tenth"?S=await Dt():e==="counter"?S=await It():e==="timer"?S=await J(!1):e==="five-second-timer"?S=await J(!0):e==="hsm-counter"?S=await z("hsm"):e==="ms-counter"?S=await z("ms"):e==="hm-one-cube"&&(S=await z("hm"))}catch(c){console.error("Failed to initialize mode:",c),t("studio-error").textContent=`Failed to load mode ${e}: ${c.message}`}}async function Pt(){await Lt();const e=new URLSearchParams(location.search),i=e.get("mode")||localStorage.getItem("cubistry_chronocube_mode")||"clock";t("studio-application").addEventListener("change",c=>{const l=c.target.value;j[l]?V(l,!0):location.assign(l)}),window.addEventListener("popstate",()=>{const l=new URLSearchParams(location.search).get("mode")||"clock";V(l,!1)}),await V(i,!1);const n=e.get("presentation")??e.get("kiosk");(n==="1"||n==="true")&&setTimeout(()=>R(!0),200)}Pt();
