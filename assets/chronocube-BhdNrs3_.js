import"./modulepreload-polyfill-P2Xu9kJm.js";import{t as e}from"./stage-C8xt5D4l.js";import{i as t,n,r,t as i}from"./statistics-CEOgqtA5.js";import{n as a,t as o}from"./hsm-source-D81MKDhc.js";import{a as s,f as c,h as l,i as u,l as d,n as f,y as p}from"./tenth-Dwlcq30r.js";import{i as m,l as h,n as g,s as _,t as v,u as y}from"./clock-9sb2Mmfo.js";import{a as b,c as x,f as ee,i as S,l as C,o as w,s as T}from"./blank-top-BW0WVUfI.js";import{n as E,r as te,t as D}from"./timer-CHpNtT0L.js";import{n as O}from"./design-BZZ_Q39J.js";import{t as k}from"./src-DN0bzogh.js";import{i as ne}from"./src-bORPnpdv.js";var A=[{id:`plastic`,color:`#202329`,roughness:.45},{id:`sticker`,color:`#ffffff`,roughness:.7}];function j(e=`dseg7`,t=`off`,n=`same`,r=`words-pascal`,i=[],a=[],o=[],s=[]){let l=c(n,e),f=d(r,l),p=u(e,t,i),m=d(`words-pascal`,l).find(e=>e.id===`T`),h=m?p.map(e=>e.id===`T`?m:e):p,g=i.filter(e=>!/^[0-9]$/.test(e.id)&&e.id!==`blank`&&e.id!==`T`),_=[...h,...g,...f.filter(e=>[`H`,`M`,`S`].includes(e.id))],v=Array.from(new Map(_.map(e=>[e.id,e])).values());return{schema:`cubistry.assets`,version:1,fonts:a,materials:s&&s.length>0?s:A,documents:o,images:v}}var M=e=>document.getElementById(e),N=`/cubistry/`,P={clock:{title:`Live H–M–S Clock`,subtitle:`One current time. Three physical cubes (Hours · Minutes · Seconds).`,count:3,badge:`H · M · S`},"ms-timer":{title:`M/S Timer & Stopwatch`,subtitle:`Minutes, seconds, and tenth-second precision timer.`,count:3,badge:`Min · Sec · 1/10s`},"hm-clock":{title:`H–M Wall Clock`,subtitle:`Two physical cubes for hours and minutes.`,count:2,badge:`H · M`},tenth:{title:`1/10-Second Counter`,subtitle:`Fast single-cube tenth-second counter (0–9).`,count:1,badge:`1/10 Sec (0–9)`},counter:{title:`Counter 0–99`,subtitle:`Certified 2-digit twisty puzzle counter.`,count:1,badge:`0–99 Counter`},timer:{title:`60-Minute Workshop Timer`,subtitle:`Physical countdown with real-time settlement.`,count:1,badge:`60-Min Timer`},"five-second-timer":{title:`5-Second Precision Timer`,subtitle:`5-second countdown with verified route.`,count:1,badge:`5-Sec Timer`},"hsm-counter":{title:`H/M/S Counter 00–59`,subtitle:`Single-cube 00–59 counter with H, M, S unit stickers.`,count:1,badge:`H/M/S (00–59)`},"ms-counter":{title:`M/S Counter 00–59`,subtitle:`Single-cube 00–59 counter with min / sec stickers.`,count:1,badge:`M/S (00–59)`},"hm-one-cube":{title:`H/M One-Cube Counter`,subtitle:`Single physical cube with hours and minutes.`,count:1,badge:`H/M One-Cube`}},F=localStorage.getItem(`cubistry_digit_font`)||`noto-sans`,I=localStorage.getItem(`cubistry_marker_mode`)||`line-auto`,L=localStorage.getItem(`cubistry_letter_font`)||`same`,R=localStorage.getItem(`cubistry_lettering`)||`words-pascal`,z=null,B=null,V=null,H=null;async function U(){return H||=await O(void 0,N),H}function W(e,t,n,r=`words-pascal`){return j(e,t,n,r,H?.assets?.images??[],H?.assets?.fonts??[],H?.assets?.documents??[],H?.assets?.materials??[])}var G=(e,t,n)=>ne(e,t,n,N);function K(e,t){let n=e.querySelector(`.cube-appearance`);if(!n||n.querySelector(`#studio-display-font`))return;let r=document.createElement(`div`);r.className=`studio-appearance-fields`,r.style.marginTop=`8px`,r.style.display=`flex`,r.style.flexDirection=`column`,r.style.gap=`6px`;let i=document.createElement(`label`);i.textContent=`Display font`;let a=document.createElement(`select`);a.id=`studio-display-font`,a.innerHTML=`
    <option value="dseg7">7-Segment (DSEG7)</option>
    <option value="dseg14">14-Segment (DSEG14)</option>
    <option value="noto-sans">Noto Sans (Calendar Standard)</option>
    <option value="quicksand">Quicksand (Rounded Geometric)</option>
    <option value="outfit">Outfit (Clean Geometric)</option>
    <option value="classic">Classic (Geometric)</option>
  `,a.value=F,i.append(a);let o=document.createElement(`label`);o.textContent=`Letter font`;let s=document.createElement(`select`);s.id=`studio-letter-font`,s.innerHTML=`
    <option value="same">Same as display font</option>
    <option value="dseg7">7-Segment (DSEG7)</option>
    <option value="dseg14">14-Segment (DSEG14)</option>
    <option value="noto-sans">Noto Sans (Calendar Standard)</option>
    <option value="quicksand">Quicksand (Rounded Geometric)</option>
    <option value="outfit">Outfit (Clean Geometric)</option>
    <option value="classic">Classic (Geometric)</option>
  `,s.value=L,o.append(s);let c=document.createElement(`label`);c.textContent=`Orientation marker`;let l=document.createElement(`select`);l.id=`studio-marker-mode`,l.innerHTML=`
    <option value="off">Off (clean stickers)</option>
    <option value="line-auto">Thin underline (6 / 9 only)</option>
    <option value="line-all">Thin underline (all digits)</option>
    <option value="dot-auto">Dot: Auto (0, 2, 5, 6, 8, 9)</option>
    <option value="dot-all">Dot: All digits (0–9)</option>
  `,l.value=I,c.append(l),r.append(i,o,c),n.append(r);let u=!1,d=async()=>{if(!u){u=!0;try{F=a.value,L=s.value,I=l.value,localStorage.setItem(`cubistry_digit_font`,F),localStorage.setItem(`cubistry_letter_font`,L),localStorage.setItem(`cubistry_marker_mode`,I),await t(W(F,I,L,R))}catch(e){console.warn(`Appearance update queued or deferred:`,e)}finally{u=!1}}};a.addEventListener(`change`,d),s.addEventListener(`change`,d),l.addEventListener(`change`,d)}function q(e,t){let n=M(`studio-controls`);n.innerHTML=`
    <div class="hud-header">
      <h2 class="hud-title">${e}</h2>
      <div class="hud-actions">
        <button type="button" class="hud-btn icon-only hud-toggle-btn" title="Minimize or expand controls">${n.classList.contains(`is-minimized`)?`⚙`:`─`}</button>
      </div>
    </div>
    <div class="hud-body">
      ${t}
    </div>
  `;let r=n.querySelector(`.hud-toggle-btn`);r?.addEventListener(`click`,()=>{n.classList.toggle(`is-minimized`),r.textContent=n.classList.contains(`is-minimized`)?`⚙`:`─`})}document.querySelector(`#presentation-btn, .island-presentation-btn`)?.addEventListener(`click`,()=>Y(!0));var J=null;function Y(e){let t=typeof e==`boolean`?e:!document.body.classList.contains(`presentation-mode`);document.body.classList.toggle(`presentation-mode`,t),t?(document.body.classList.add(`show-exit-btn`),clearTimeout(J),J=setTimeout(()=>{document.body.classList.remove(`show-exit-btn`)},2500),document.documentElement.requestFullscreen&&!document.fullscreenElement&&document.documentElement.requestFullscreen().catch(()=>{})):(document.body.classList.remove(`show-exit-btn`),document.fullscreenElement&&document.exitFullscreen&&document.exitFullscreen().catch(()=>{})),z?.resetCamera?.(),B?.resetCamera?.()}window.addEventListener(`mousemove`,()=>{document.body.classList.contains(`presentation-mode`)&&(document.body.classList.add(`show-exit-btn`),clearTimeout(J),J=setTimeout(()=>{document.body.classList.remove(`show-exit-btn`)},2500))}),document.addEventListener(`fullscreenchange`,()=>{!document.fullscreenElement&&document.body.classList.contains(`presentation-mode`)&&Y(!1)}),M(`exit-presentation-btn`)?.addEventListener(`click`,()=>Y(!1)),window.addEventListener(`keydown`,e=>{e.key===`Escape`&&document.body.classList.contains(`presentation-mode`)&&Y(!1)});async function X(){let s=M(`studio-cards`);s.setAttribute(`data-count`,`3`),s.innerHTML=`
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
  `,q(`Live Time`,`
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
  `),M(`clock-lettering`).value=R;let c=new e(M(`studio-scene`),3);z=c;let l=[`hours`,`minutes`,`seconds`],u=[new Date().getHours(),new Date().getMinutes(),new Date().getSeconds()],d={hours:500,minutes:250,seconds:100},f=await p(N,o.runtimeSHA256),m=new i(l.length),h=new r,g=-1;function _(){let e=m.snapshot();if(e.revision===g)return;g=e.revision;let t=(e,t,n=e=>String(e))=>{let r=M(e);r&&(r.textContent=t===null?`—`:n(t))};e.units.forEach((e,r)=>{let i=l[r];t(i+`-session-moves`,e.session.htm),t(i+`-session-rotations`,e.session.rotations),t(i+`-last-moves`,e.last),t(i+`-max-moves`,e.max),t(i+`-mean-moves`,e.mean,n)})}let v=[],y=[];for(let e=0;e<3;e++){let t=c.createCube(M(`clock-`+l[e]),e),n=d[l[e]],r=e=>t.setAnimationSpeed(75/e,`quarter-turn`);r(n);let i=W(F,I,L,R),o=new a(t,f,{printDefinition:f.printDefinition,name:l[e],assets:i,onMoveCommitted:t=>m.recordMove(e,t),onRotationCommitted:t=>m.recordRotation(e,t)});await o.configure(u[e]),v.push(o),y.push({controller:o,duration:n,setDuration:r})}K(c.appearancePanel,async e=>{await Promise.all(v.map(t=>t.updateManifest(e)))}),M(`clock-lettering`).addEventListener(`change`,async()=>{R=M(`clock-lettering`).value,localStorage.setItem(`cubistry_lettering`,R);let e=W(F,I,L,R);await Promise.all(v.map(t=>t.updateManifest(e)))}),M(`reset-clock-moves`)?.addEventListener(`click`,()=>{m.reset(),_()});function b(){try{let e=Date.now(),n=performance.now(),r=h.tick(e,n,y);m.closeTick(),_();let i=M(`clock-digital`);i&&(i.textContent=t(r.values));let a=M(`clock-status`);a&&(a.textContent=r.motion.includes(`synchronizing`)?`Synchronizing to current time`:`Live · local time`),y.forEach((e,t)=>{let n=M(l[t]+`-state`);if(n){let i=r.motion[t];n.dataset.state=i,n.textContent=`${String(e.controller.currentValue).padStart(2,`0`)}${i===`idle`?``:i===`moving`?` · Moving`:` · Synchronizing`}`}})}catch(e){console.error(e)}}let x=setInterval(b,100);return b(),()=>{clearInterval(x),c.destroy()}}async function re(){let t=M(`studio-cards`);t.setAttribute(`data-count`,`3`),t.innerHTML=`
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
  `,q(`M/S Timer`,`
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
  `);let n=new e(M(`studio-scene`),3);z=n;let r=await l(N,y.runtimeSHA256),i=W(F,I,L,`words-pascal`),a={major:n.createCube(M(`ms-minutes`),0),minor:n.createCube(M(`ms-seconds`),1),tenth:n.createCube(M(`ms-tenths`),2)},o=e=>t=>a[e]?.setAnimationSpeed(75/t),s=null,c=null,u=(e,t)=>n=>{let a=new E(t,r.print,i,e,n,G);return e===`M`&&(s=a),e===`S`&&(c=a),a},d=new te({minorModulus:60,majorModulus:60,createMinor:u(`S`,a.minor),createMajor:u(`M`,a.major),onState:()=>v()}),p=new f(a.tenth,i,()=>v(),G),m=new D({pair:d,tenth:p,preferred:()=>100,setDuration:{minor:o(`minor`),major:o(`major`),tenth:o(`tenth`)},refresh:()=>_()});K(n.appearancePanel,async e=>{await Promise.all([s?.updateManifest(e),c?.updateManifest(e),p?.updateManifest(e)])});function _(){m.tick(),v()}function v(){if(!m)return;let e=!m.running&&!m.busy;M(`timer-logical`).textContent=m.text,M(`ms-minutes-state`).textContent=`${String(d.major.currentValue).padStart(2,`0`)}${d.major.busy?` · Moving`:``}`,M(`ms-seconds-state`).textContent=`${String(d.minor.currentValue).padStart(2,`0`)}${d.minor.busy?` · Moving`:``}`,M(`ms-tenths-state`).textContent=`.${p.currentValue}${p.busy?` · Moving`:``}`,M(`timer-start`).textContent=m.running?`Pause`:`Start`,M(`timer-mode`).disabled=!e,M(`timer-duration`).disabled=m.running,M(`timer-set`).disabled=m.running,M(`timer-reset`).disabled=m.running,M(`timer-duration-setting`).hidden=m.mode===`stopwatch`;let t=m.busy?`Moving / Synchronizing`:m.running?`Running`:`Idle`;M(`timer-motion-label`).textContent=t}M(`timer-start`).addEventListener(`click`,()=>{m.running?m.pause():m.start(),v()}),M(`timer-reset`).addEventListener(`click`,()=>{m.reset(),v()}),M(`timer-mode`).addEventListener(`change`,()=>{m.setMode(M(`timer-mode`).value),v()}),M(`timer-duration-form`).addEventListener(`submit`,e=>{e.preventDefault();let t=h(M(`timer-duration`).value);t!==null&&(m.configure(t),v())}),await Promise.all([d.configure(g.defaultSeconds),p.configure(0)]),o(`minor`)(100),o(`major`)(250),o(`tenth`)(50),v();let b=setInterval(_,50);return()=>{clearInterval(b),n.destroy()}}async function ie(){let t=M(`studio-cards`);t.setAttribute(`data-count`,`2`),t.innerHTML=`
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
  `,q(`Live Wall Time`,`
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
  `),M(`clock-lettering`).value=R;let n=new e(M(`studio-scene`),2);z=n;let i=[`hours`,`minutes`],s=[new Date().getHours(),new Date().getMinutes()],c={hours:500,minutes:250},l=await p(N,o.runtimeSHA256),u=new r,d=[],f=[];for(let e=0;e<2;e++){let t=n.createCube(M(`clock-`+i[e]),e),r=c[i[e]],o=e=>t.setAnimationSpeed(75/e,`quarter-turn`);o(r);let u=W(F,I,L,R),p=new a(t,l,{printDefinition:l.printDefinition,name:i[e],assets:u});await p.configure(s[e]),d.push(p),f.push({controller:p,duration:r,setDuration:o})}K(n.appearancePanel,async e=>{await Promise.all(d.map(t=>t.updateManifest(e)))}),M(`clock-lettering`).addEventListener(`change`,async()=>{R=M(`clock-lettering`).value,localStorage.setItem(`cubistry_lettering`,R);let e=W(F,I,L,R);await Promise.all(d.map(t=>t.updateManifest(e)))});function m(){try{let e=Date.now(),t=performance.now(),n=u.tick(e,t,f),r=M(`clock-digital`);r&&(r.textContent=`${String(n.values[0]).padStart(2,`0`)}:${String(n.values[1]).padStart(2,`0`)}`),f.forEach((e,t)=>{let r=M(i[t]+`-state`);if(r){let i=n.motion[t];r.dataset.state=i,r.textContent=`${String(e.controller.currentValue).padStart(2,`0`)}${i===`idle`?``:` · Moving`}`}})}catch(e){console.error(e)}}let h=setInterval(m,100);return m(),()=>{clearInterval(h),n.destroy()}}async function ae(){let e=M(`studio-cards`);e.setAttribute(`data-count`,`1`),e.innerHTML=`
    <article class="clock-card" style="text-align: center;">
      <h2>Tenth-Second Display</h2>
      <output id="tenth-value-display" class="studio-digital-huge" style="display: block;">.0</output>
      <p id="tenth-state" class="clock-state" role="status">Ready</p>
    </article>
  `,q(`1/10-Second Counter`,`
    <p class="small">Period-1 {L, D, B} sequence with fast responsive stepping.</p>
    <div class="tenth-quick-grid">
      ${[0,1,2,3,4,5,6,7,8,9].map(e=>`<button class="tenth-quick-btn" data-val="${e}">${e}</button>`).join(``)}
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
  `);let t=new k(M(`studio-scene`));B=t;let n=W(F,I,L,`words-pascal`),r=100,i=1;function a(e){let n=s(e);t.setAnimationSpeed(75/n)}a(r);let o=new f(t,n,(e,t,n)=>{M(`tenth-value-display`).textContent=`.${e}`,M(`tenth-state`).textContent=t?`Moving…`:`Ready`,n&&console.error(n)},G);return K(M(`studio-scene`),async e=>{await o.updateManifest(e)}),await o.configure(0),controlsContainer.querySelectorAll(`.tenth-quick-btn`).forEach(e=>{e.addEventListener(`click`,()=>{o.stepTo(Number(e.dataset.val),i)})}),M(`tenth-step-plus5`).addEventListener(`click`,()=>{o.stepBy(5*i)}),M(`tenth-step-minus5`).addEventListener(`click`,()=>{o.stepBy(-5*i)}),M(`tenth-speed-select`).addEventListener(`change`,e=>{r=Number(e.target.value),a(r)}),M(`tenth-direction-toggle`).addEventListener(`change`,e=>{i=Number(e.target.value)}),()=>{t.destroy()}}async function oe(){let e=M(`studio-cards`);e.setAttribute(`data-count`,`1`),e.innerHTML=`
    <article class="clock-card" style="text-align: center;">
      <h2>Counter Value</h2>
      <output id="counter-value-display" class="studio-digital-huge" style="display: block;">00</output>
      <p id="counter-state" class="clock-state" role="status">Ready</p>
    </article>
  `,q(`Counter Controls`,`
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
  `);let t=new k(M(`studio-scene`));B=t,t.setAnimationSpeed(75/100);let[n,r]=await Promise.all([O(void 0,N),b(N)]),i=W(F,I,L),a=new S(t,n,{certified:r,assets:i,onState:(e,t)=>{M(`counter-value-display`).textContent=String(e).padStart(2,`0`),M(`counter-state`).textContent=t?`Turning…`:`Ready`}});K(M(`studio-scene`),async e=>{await a.updateManifest(e)}),await a.configure(0);let o=e=>{let t=(a.currentValue+e+100)%100;a.request(t)};M(`counter-plus-1`).addEventListener(`click`,()=>o(1)),M(`counter-minus-1`).addEventListener(`click`,()=>o(-1)),M(`counter-plus-10`).addEventListener(`click`,()=>o(10)),M(`counter-minus-10`).addEventListener(`click`,()=>o(-10)),M(`counter-reset`).addEventListener(`click`,()=>a.request(0));let s=null;return M(`counter-auto-step`).addEventListener(`change`,e=>{e.target.checked?s=setInterval(()=>o(1),1e3):(clearInterval(s),s=null)}),()=>{s&&clearInterval(s),t.destroy()}}async function Z(e=!1){let t=M(`studio-cards`);t.setAttribute(`data-count`,`1`),t.innerHTML=`
    <article class="clock-card" style="text-align: center;">
      <h2>${e?`5-Second Countdown`:`60-Minute Countdown`}</h2>
      <output id="timer-display" class="studio-digital-huge" style="display: block;">
        ${e?`00:05.0`:`15:00`}
      </output>
      <p id="timer-state" class="clock-state" role="status">Ready</p>
    </article>
  `,q(e?`5-Second Timer`:`Workshop Timer`,`
    <div style="display: flex; gap: 8px; margin: 12px 0;">
      <button id="timer-toggle-btn" class="primary" style="flex: 1;">Start</button>
      <button id="timer-reset-btn" style="flex: 1;">Reset</button>
    </div>
    <p id="timer-status-info" class="small">Idle · Tap Start to countdown</p>
  `);let n=new k(M(`studio-scene`));B=n,n.setAnimationSpeed(75/100);let r=e?await T(N):await x(N),i=e?v:g,a=new m(void 0,i),o=W(F,I,L),s=new w(n,r,{assets:o,onState:(e,t)=>{M(`timer-state`).textContent=t?`Moving…`:`Ready`}});K(M(`studio-scene`),async e=>{await s.updateManifest(e)});let c=e?5:900;await s.configure(c);function l(){let e=a.snapshot();M(`timer-display`).textContent=_(e.bucket,i.maxSeconds),M(`timer-toggle-btn`).textContent=a.running?`Pause`:`Start`,M(`timer-status-info`).textContent=a.running?`Counting down…`:`Paused`}M(`timer-toggle-btn`).addEventListener(`click`,()=>{a.running?a.pause():a.start(),l()}),M(`timer-reset-btn`).addEventListener(`click`,()=>{a.reset(),s.request(c),l()}),l();let u=setInterval(l,100);return()=>{clearInterval(u),n.destroy()}}async function Q(e=`hsm`){let t=M(`studio-cards`);t.setAttribute(`data-count`,`1`),t.innerHTML=`
    <article class="clock-card" style="text-align: center;">
      <h2 id="single-hsm-title">Counter 00–59</h2>
      <output id="hsm-value-display" class="studio-digital-huge" style="display: block;">00</output>
      <p id="hsm-state" class="clock-state" role="status">Ready</p>
    </article>
  `,q(`Counter Controls`,`
    <div style="margin-bottom: 12px;">
      <label for="single-unit-select">Unit sticker</label>
      <select id="single-unit-select">
        ${e===`hsm`?`
          <option value="H">Hour (H)</option>
          <option value="M" selected>Minute (M)</option>
          <option value="S">Second (S)</option>
        `:e===`ms`?`
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
  `);let n=new k(M(`studio-scene`));B=n,n.setAnimationSpeed(75/100);let r=e===`ms`?await l(N,y.runtimeSHA256):e===`hm`?await ee(N,C.runtimeSHA256):await p(N,o.runtimeSHA256),i=W(F,I,L,R),s=new a(n,r,{printDefinition:r.printDefinition,name:`unit`,assets:i,onState:(e,t)=>{M(`hsm-value-display`).textContent=String(e).padStart(2,`0`),M(`hsm-state`).textContent=t?`Turning…`:`Ready`}});K(M(`studio-scene`),async e=>{await s.updateManifest(e)}),await s.configure(0);let c=e=>{let t=(s.currentValue+e+60)%60;s.request(t)};return M(`hsm-plus-1`).addEventListener(`click`,()=>c(1)),M(`hsm-minus-1`).addEventListener(`click`,()=>c(-1)),M(`hsm-plus-10`).addEventListener(`click`,()=>c(10)),M(`hsm-minus-10`).addEventListener(`click`,()=>c(-10)),M(`hsm-reset`).addEventListener(`click`,()=>s.request(0)),()=>{n.destroy()}}async function $(e,t=!0){if(P[e]||(e=`clock`),V){try{V()}catch(e){console.warn(`Cleanup error:`,e)}V=null}M(`studio-scene`).innerHTML=``,M(`studio-cards`).innerHTML=``,M(`studio-controls`).innerHTML=``,M(`studio-error`).textContent=``;let n=P[e];if(M(`studio-heading`).textContent=n.title,M(`studio-subtitle`).textContent=n.subtitle,M(`studio-cube-count-badge`).textContent=`${n.count} CUBE${n.count>1?`S`:``}`,M(`studio-mode-label`).textContent=n.badge,M(`studio-application`).value=e,t){let t=new URL(location.href);t.searchParams.set(`mode`,e),history.replaceState(null,``,t),localStorage.setItem(`cubistry_chronocube_mode`,e)}try{e===`clock`?V=await X():e===`ms-timer`?V=await re():e===`hm-clock`?V=await ie():e===`tenth`?V=await ae():e===`counter`?V=await oe():e===`timer`?V=await Z(!1):e===`five-second-timer`?V=await Z(!0):e===`hsm-counter`?V=await Q(`hsm`):e===`ms-counter`?V=await Q(`ms`):e===`hm-one-cube`&&(V=await Q(`hm`))}catch(t){console.error(`Failed to initialize mode:`,t),M(`studio-error`).textContent=`Failed to load mode ${e}: ${t.message}`}}async function se(){await U();let e=new URLSearchParams(location.search),t=e.get(`mode`)||localStorage.getItem(`cubistry_chronocube_mode`)||`clock`;M(`studio-application`).addEventListener(`change`,e=>{let t=e.target.value;P[t]?$(t,!0):location.assign(t)}),window.addEventListener(`popstate`,()=>{$(new URLSearchParams(location.search).get(`mode`)||`clock`,!1)}),await $(t,!1);let n=e.get(`presentation`)??e.get(`kiosk`);(n===`1`||n===`true`)&&setTimeout(()=>Y(!0),200)}se();