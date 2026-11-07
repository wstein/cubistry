import"./modulepreload-polyfill-P2Xu9kJm.js";import{t as e}from"./stage-C8xt5D4l.js";import{i as t,n,r,t as i}from"./statistics-DYzDrkab.js";import{n as a,t as o}from"./hsm-source-D81MKDhc.js";import{d as s,i as c,n as l,r as u,s as d,t as f,u as p}from"./clock-CJzB_Oks.js";import{a as m,d as h,f as g,i as _,o as v,s as y,u as b}from"./blank-top-CB1BTWRN.js";import{n as x}from"./design-BZZ_Q39J.js";import{a as ee,f as S,h as C,i as te,l as w,n as T,o as ne,y as E}from"./tenth-Dwlcq30r.js";import{n as re,r as D,t as O}from"./timer-Oa2FOAfn.js";import{t as k}from"./src-DN0bzogh.js";import{i as A}from"./src-bORPnpdv.js";function j(e,t,n,r,i,o,s=59){let c=new a(e,t,n,r,i,o);return c.setMode(s,1),c}function ie(e,t,n,r,i,a,o){return e===`ms`?new s(t,n.print,r,i,a,o):j(t,n,r,i,a,o,e===`hm`&&i===`H`?23:59)}async function ae(e){let t=await x(void 0,e.base),n=await g(t,e.base),r=new h(e.view,t,e.onState,e.resolveAssets);return await r.configure(`COUNTER`,n.padded,0,n),await r.updateManifest(e.manifest),r}function M(e,t){return(...n)=>e()?t(...n):void 0}function oe(e=()=>{},t=()=>{}){let n=null,r=0,i=e=>{try{e?.()}catch(e){t(e)}};return{async switchTo(t,a=()=>{}){let o=++r;i(n),n=null,a();try{let e=await t(()=>o===r);return o===r?(n=e,!0):(i(e),!1)}catch(t){return o===r&&e(t),!1}}}}function se(e,t,n,r){try{e.set(t).then(n,e=>r(e.message))}catch(e){r(e.message)}}function ce(e){return e?f:u}function le(e,t,n,r,i){return new _(e,t,n,r,i)}function ue(e){return e.defaultSeconds/e.stepSeconds}function de(e,t){return d(e,t)}var fe=class{parts;scheduler;constructor(e){this.parts=e,this.scheduler=new ne(()=>this.tick(),()=>e.clock.snapshot())}start(){this.parts.clock.start(),this.tick()}pause(){this.parts.clock.pause(),this.reconcile(),this.tick()}reset(){this.parts.clock.reset(),this.reconcile()}tick(){try{let{clock:e,controller:t,setDuration:n}=this.parts;this.scheduler.tick(e.snapshot(),t,100,n)}catch(e){(this.parts.onError??console.error)(e)}}reconcile(){this.scheduler.invalidate(),this.parts.setDuration(100),this.parts.controller.request(this.parts.clock.snapshot().bucket)}dispose(){this.scheduler.invalidate()}},pe=[{id:`plastic`,color:`#202329`,roughness:.45},{id:`sticker`,color:`#ffffff`,roughness:.7}];function me(e=`dseg7`,t=`off`,n=`same`,r=`words-pascal`,i=[],a=[],o=[],s=[]){let c=S(n,e),l=w(r,c),u=te(e,t,i),d=w(`words-pascal`,c).find(e=>e.id===`T`),f=d?u.map(e=>e.id===`T`?d:e):u,p=i.filter(e=>!/^[0-9]$/.test(e.id)&&e.id!==`blank`&&e.id!==`T`),m=[...f,...p,...l.filter(e=>[`H`,`M`,`S`].includes(e.id))],h=Array.from(new Map(m.map(e=>[e.id,e])).values());return{schema:`cubistry.assets`,version:1,fonts:a,materials:s&&s.length>0?s:pe,documents:o,images:h}}var N=e=>document.getElementById(e),P=`/cubistry/`,F={clock:{title:`Live H–M–S Clock`,subtitle:`One current time. Three physical cubes (Hours · Minutes · Seconds).`,count:3,badge:`H · M · S`},"ms-timer":{title:`M/S Timer & Stopwatch`,subtitle:`Minutes, seconds, and tenth-second precision timer.`,count:3,badge:`Min · Sec · 1/10s`},"hm-clock":{title:`H–M Wall Clock`,subtitle:`Two physical cubes for hours and minutes.`,count:2,badge:`H · M`},tenth:{title:`1/10-Second Counter`,subtitle:`Fast single-cube tenth-second counter (0–9).`,count:1,badge:`1/10 Sec (0–9)`},counter:{title:`Counter 0–99`,subtitle:`Certified 2-digit twisty puzzle counter.`,count:1,badge:`0–99 Counter`},timer:{title:`60-Minute Workshop Timer`,subtitle:`Physical countdown with real-time settlement.`,count:1,badge:`60-Min Timer`},"five-second-timer":{title:`5-Second Precision Timer`,subtitle:`5-second countdown with verified route.`,count:1,badge:`5-Sec Timer`},"hsm-counter":{title:`H/M/S Counter 00–59`,subtitle:`Single-cube 00–59 counter with H, M, S unit stickers.`,count:1,badge:`H/M/S (00–59)`},"ms-counter":{title:`M/S Counter 00–59`,subtitle:`Single-cube 00–59 counter with min / sec stickers.`,count:1,badge:`M/S (00–59)`},"hm-one-cube":{title:`H/M One-Cube Counter`,subtitle:`Single physical cube with hours and minutes.`,count:1,badge:`H/M One-Cube`}},I=localStorage.getItem(`cubistry_digit_font`)||`noto-sans`,L=localStorage.getItem(`cubistry_marker_mode`)||`line-auto`,R=localStorage.getItem(`cubistry_letter_font`)||`same`,z=localStorage.getItem(`cubistry_lettering`)||`words-pascal`,B=null,V=null,H=null,U=null;async function he(){return U||=await x(void 0,P),U}function W(e,t,n,r=`words-pascal`){return me(e,t,n,r,U?.assets?.images??[],U?.assets?.fonts??[],U?.assets?.documents??[],U?.assets?.materials??[])}var G=(e,t,n)=>A(e,t,n,P);function K(e,t){let n=e.querySelector(`.cube-appearance`);if(!n||n.querySelector(`#studio-display-font`))return;let r=document.createElement(`div`);r.className=`studio-appearance-fields`,r.style.marginTop=`8px`,r.style.display=`flex`,r.style.flexDirection=`column`,r.style.gap=`6px`;let i=document.createElement(`label`);i.textContent=`Display font`;let a=document.createElement(`select`);a.id=`studio-display-font`,a.innerHTML=`
    <option value="dseg7">7-Segment (DSEG7)</option>
    <option value="dseg14">14-Segment (DSEG14)</option>
    <option value="noto-sans">Noto Sans (Calendar Standard)</option>
    <option value="quicksand">Quicksand (Rounded Geometric)</option>
    <option value="outfit">Outfit (Clean Geometric)</option>
    <option value="classic">Classic (Geometric)</option>
  `,a.value=I,i.append(a);let o=document.createElement(`label`);o.textContent=`Letter font`;let s=document.createElement(`select`);s.id=`studio-letter-font`,s.innerHTML=`
    <option value="same">Same as display font</option>
    <option value="dseg7">7-Segment (DSEG7)</option>
    <option value="dseg14">14-Segment (DSEG14)</option>
    <option value="noto-sans">Noto Sans (Calendar Standard)</option>
    <option value="quicksand">Quicksand (Rounded Geometric)</option>
    <option value="outfit">Outfit (Clean Geometric)</option>
    <option value="classic">Classic (Geometric)</option>
  `,s.value=R,o.append(s);let c=document.createElement(`label`);c.textContent=`Orientation marker`;let l=document.createElement(`select`);l.id=`studio-marker-mode`,l.innerHTML=`
    <option value="off">Off (clean stickers)</option>
    <option value="line-auto">Thin underline (6 / 9 only)</option>
    <option value="line-all">Thin underline (all digits)</option>
    <option value="dot-auto">Dot: Auto (0, 2, 5, 6, 8, 9)</option>
    <option value="dot-all">Dot: All digits (0–9)</option>
  `,l.value=L,c.append(l),r.append(i,o,c),n.append(r);let u=!1,d=async()=>{if(!u){u=!0;try{I=a.value,R=s.value,L=l.value,localStorage.setItem(`cubistry_digit_font`,I),localStorage.setItem(`cubistry_letter_font`,R),localStorage.setItem(`cubistry_marker_mode`,L),await t(W(I,L,R,z))}catch(e){console.warn(`Appearance update queued or deferred:`,e)}finally{u=!1}}};a.addEventListener(`change`,d),s.addEventListener(`change`,d),l.addEventListener(`change`,d)}function q(e,t){let n=N(`studio-controls`);n.innerHTML=`
    <div class="hud-header">
      <h2 class="hud-title">${e}</h2>
      <div class="hud-actions">
        <button type="button" class="hud-btn icon-only hud-toggle-btn" title="Minimize or expand controls">${n.classList.contains(`is-minimized`)?`⚙`:`─`}</button>
      </div>
    </div>
    <div class="hud-body">
      ${t}
    </div>
  `;let r=n.querySelector(`.hud-toggle-btn`);r?.addEventListener(`click`,()=>{n.classList.toggle(`is-minimized`),r.textContent=n.classList.contains(`is-minimized`)?`⚙`:`─`})}document.querySelector(`#presentation-btn, .island-presentation-btn`)?.addEventListener(`click`,()=>Y(!0));var J=null;function Y(e){let t=typeof e==`boolean`?e:!document.body.classList.contains(`presentation-mode`);document.body.classList.toggle(`presentation-mode`,t),t?(document.body.classList.add(`show-exit-btn`),clearTimeout(J),J=setTimeout(()=>{document.body.classList.remove(`show-exit-btn`)},2500),document.documentElement.requestFullscreen&&!document.fullscreenElement&&document.documentElement.requestFullscreen().catch(()=>{})):(document.body.classList.remove(`show-exit-btn`),document.fullscreenElement&&document.exitFullscreen&&document.exitFullscreen().catch(()=>{})),V?.resetCamera?.(),H?.resetCamera?.()}window.addEventListener(`mousemove`,()=>{document.body.classList.contains(`presentation-mode`)&&(document.body.classList.add(`show-exit-btn`),clearTimeout(J),J=setTimeout(()=>{document.body.classList.remove(`show-exit-btn`)},2500))}),document.addEventListener(`fullscreenchange`,()=>{!document.fullscreenElement&&document.body.classList.contains(`presentation-mode`)&&Y(!1)}),N(`exit-presentation-btn`)?.addEventListener(`click`,()=>Y(!1)),window.addEventListener(`keydown`,e=>{e.key===`Escape`&&document.body.classList.contains(`presentation-mode`)&&Y(!1)});async function ge(a){let s=N(`studio-cards`);s.setAttribute(`data-count`,`3`),s.innerHTML=`
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
  `),N(`clock-lettering`).value=z;let c=new e(N(`studio-scene`),3);V=c;let l=()=>(c.destroy(),null),u=[`hours`,`minutes`,`seconds`],d=[new Date().getHours(),new Date().getMinutes(),new Date().getSeconds()],f={hours:500,minutes:250,seconds:100},p=await E(P,o.runtimeSHA256);if(!a())return l();let m=new i(u.length),h=new r,g=-1;function _(){let e=m.snapshot();if(e.revision===g)return;g=e.revision;let t=(e,t,n=e=>String(e))=>{let r=N(e);r&&(r.textContent=t===null?`—`:n(t))};e.units.forEach((e,r)=>{let i=u[r];t(i+`-session-moves`,e.session.htm),t(i+`-session-rotations`,e.session.rotations),t(i+`-last-moves`,e.last),t(i+`-max-moves`,e.max),t(i+`-mean-moves`,e.mean,n)})}let v=[],y=[];for(let e=0;e<3;e++){let t=c.createCube(N(`clock-`+u[e]),e),n=f[u[e]],r=e=>t.setAnimationSpeed(75/e,`quarter-turn`);r(n);let i=j(t,p,W(I,L,R,z),[`H`,`M`,`S`][e],(t,n,r,i)=>{a()&&(i&&m.observe(e,i),r&&(N(`studio-error`).textContent=r.message))},G,e===0?23:59);if(await i.configure(d[e]),!a())return l();v.push(i),y.push({controller:i,duration:n,setDuration:r})}K(c.appearancePanel,M(a,async e=>{await Promise.all(v.map(t=>t.updateManifest(e)))})),N(`clock-lettering`).addEventListener(`change`,async()=>{z=N(`clock-lettering`).value,localStorage.setItem(`cubistry_lettering`,z);let e=W(I,L,R,z);await Promise.all(v.map(t=>t.updateManifest(e)))}),N(`reset-clock-moves`)?.addEventListener(`click`,()=>{m.reset(),_()});function b(){try{let e=Date.now(),n=performance.now(),r=h.tick(e,n,y);m.closeTick(),_();let i=N(`clock-digital`);i&&(i.textContent=t(r.values));let a=N(`clock-status`);a&&(a.textContent=r.motion.includes(`synchronizing`)?`Synchronizing to current time`:`Live · local time`),y.forEach((e,t)=>{let n=N(u[t]+`-state`);if(n){let i=r.motion[t];n.dataset.state=i,n.textContent=`${String(e.controller.currentValue).padStart(2,`0`)}${i===`idle`?``:i===`moving`?` · Moving`:` · Synchronizing`}`}})}catch(e){console.error(e)}}let x=setInterval(b,100);return b(),()=>{clearInterval(x),c.destroy()}}async function _e(t){let n=N(`studio-cards`);n.setAttribute(`data-count`,`3`),n.innerHTML=`
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
  `);let r=new e(N(`studio-scene`),3);V=r;let i=()=>(r.destroy(),null),a=await C(P,p.runtimeSHA256);if(!t())return i();let o=W(I,L,R,`words-pascal`),s={major:r.createCube(N(`ms-minutes`),0),minor:r.createCube(N(`ms-seconds`),1),tenth:r.createCube(N(`ms-tenths`),2)},c=e=>t=>s[e]?.setAnimationSpeed(75/t),u=null,d=null,f=(e,t)=>n=>{let r=new re(t,a.print,o,e,n,G);return e===`M`&&(u=r),e===`S`&&(d=r),r},m=new D({minorModulus:60,majorModulus:60,createMinor:f(`S`,s.minor),createMajor:f(`M`,s.major),onState:()=>v()}),h=new T(s.tenth,o,()=>v(),G),g=new O({pair:m,tenth:h,preferred:()=>100,setDuration:{minor:c(`minor`),major:c(`major`),tenth:c(`tenth`)},refresh:()=>_()});K(r.appearancePanel,M(t,async e=>{await Promise.all([u?.updateManifest(e),d?.updateManifest(e),h?.updateManifest(e)])}));function _(){g.tick(),v()}function v(){if(!g||!t())return;let e=!g.running&&!g.busy;N(`timer-logical`).textContent=g.text,N(`ms-minutes-state`).textContent=`${String(m.major.currentValue).padStart(2,`0`)}${m.major.busy?` · Moving`:``}`,N(`ms-seconds-state`).textContent=`${String(m.minor.currentValue).padStart(2,`0`)}${m.minor.busy?` · Moving`:``}`,N(`ms-tenths-state`).textContent=`.${h.currentValue}${h.busy?` · Moving`:``}`,N(`timer-start`).textContent=g.running?`Pause`:`Start`,N(`timer-mode`).disabled=!e,N(`timer-duration`).disabled=g.running,N(`timer-set`).disabled=g.running,N(`timer-reset`).disabled=g.running,N(`timer-duration-setting`).hidden=g.mode===`stopwatch`;let n=g.busy?`Moving / Synchronizing`:g.running?`Running`:`Idle`;N(`timer-motion-label`).textContent=n}if(N(`timer-start`).addEventListener(`click`,()=>{g.running?g.pause():g.start(),v()}),N(`timer-reset`).addEventListener(`click`,()=>{g.reset(),v()}),N(`timer-mode`).addEventListener(`change`,()=>{g.setMode(N(`timer-mode`).value),v()}),N(`timer-duration-form`).addEventListener(`submit`,e=>{e.preventDefault(),N(`studio-error`).textContent=``,se(g,N(`timer-duration`).value,v,e=>{N(`studio-error`).textContent=e})}),await Promise.all([m.configure(l.defaultSeconds),h.configure(0)]),!t())return i();c(`minor`)(100),c(`major`)(250),c(`tenth`)(50),v();let y=setInterval(_,50);return()=>{clearInterval(y),r.destroy()}}async function ve(t){let n=N(`studio-cards`);n.setAttribute(`data-count`,`2`),n.innerHTML=`
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
  `),N(`clock-lettering`).value=z;let i=new e(N(`studio-scene`),2);V=i;let a=()=>(i.destroy(),null),s=[`hours`,`minutes`],c=[new Date().getHours(),new Date().getMinutes()],l={hours:500,minutes:250},u=await E(P,o.runtimeSHA256);if(!t())return a();let d=new r,f=[],p=[];for(let e=0;e<2;e++){let n=i.createCube(N(`clock-`+s[e]),e),r=l[s[e]],o=e=>n.setAnimationSpeed(75/e,`quarter-turn`);o(r);let d=j(n,u,W(I,L,R,z),[`H`,`M`][e],(e,n,r)=>{t()&&r&&(N(`studio-error`).textContent=r.message)},G,e===0?23:59);if(await d.configure(c[e]),!t())return a();f.push(d),p.push({controller:d,duration:r,setDuration:o})}K(i.appearancePanel,M(t,async e=>{await Promise.all(f.map(t=>t.updateManifest(e)))})),N(`clock-lettering`).addEventListener(`change`,async()=>{z=N(`clock-lettering`).value,localStorage.setItem(`cubistry_lettering`,z);let e=W(I,L,R,z);await Promise.all(f.map(t=>t.updateManifest(e)))});function m(){try{let e=Date.now(),t=performance.now(),n=d.tick(e,t,p),r=N(`clock-digital`);r&&(r.textContent=`${String(n.values[0]).padStart(2,`0`)}:${String(n.values[1]).padStart(2,`0`)}`),p.forEach((e,t)=>{let r=N(s[t]+`-state`);if(r){let i=n.motion[t];r.dataset.state=i,r.textContent=`${String(e.controller.currentValue).padStart(2,`0`)}${i===`idle`?``:` · Moving`}`}})}catch(e){console.error(e)}}let h=setInterval(m,100);return m(),()=>{clearInterval(h),i.destroy()}}async function ye(e){let t=N(`studio-cards`);t.setAttribute(`data-count`,`1`),t.innerHTML=`
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
  `);let n=new k(N(`studio-scene`));H=n;let r=()=>(n.destroy(),null),i=W(I,L,R,`words-pascal`),a=100,o=1;function s(e){let t=ee(e);n.setAnimationSpeed(75/t)}s(a);let c=new T(n,i,(t,n,r)=>{e()&&(N(`tenth-value-display`).textContent=`.${t}`,N(`tenth-state`).textContent=n?`Moving…`:`Ready`,r&&console.error(r))},G);return K(N(`studio-scene`),M(e,async e=>{await c.updateManifest(e)})),await c.configure(0),e()?(N(`studio-controls`).querySelectorAll(`.tenth-quick-btn`).forEach(e=>{e.addEventListener(`click`,()=>{c.set(Number(e.dataset.val))})}),N(`tenth-step-plus5`).addEventListener(`click`,()=>{c.step(5*o)}),N(`tenth-step-minus5`).addEventListener(`click`,()=>{c.step(-5*o)}),N(`tenth-speed-select`).addEventListener(`change`,e=>{a=Number(e.target.value),s(a)}),N(`tenth-direction-toggle`).addEventListener(`change`,e=>{o=Number(e.target.value)}),()=>{n.destroy()}):r()}async function X(e){let t=N(`studio-cards`);t.setAttribute(`data-count`,`1`),t.innerHTML=`
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
  `);let n=new k(N(`studio-scene`));H=n;let r=()=>(n.destroy(),null);n.setAnimationSpeed(75/100);let i=await ae({base:P,view:n,manifest:W(I,L,R),onState:(t,n)=>{e()&&(N(`counter-value-display`).textContent=String(t).padStart(2,`0`),N(`counter-state`).textContent=n?`Turning…`:`Ready`)},resolveAssets:G});if(!e())return r();K(N(`studio-scene`),M(e,async e=>{await i.updateManifest(e)}));let a=e=>{let t=(i.currentValue+e+100)%100;i.request(t)};N(`counter-plus-1`).addEventListener(`click`,()=>a(1)),N(`counter-minus-1`).addEventListener(`click`,()=>a(-1)),N(`counter-plus-10`).addEventListener(`click`,()=>a(10)),N(`counter-minus-10`).addEventListener(`click`,()=>a(-10)),N(`counter-reset`).addEventListener(`click`,()=>i.request(0));let o=null;return N(`counter-auto-step`).addEventListener(`change`,e=>{e.target.checked?o=setInterval(()=>a(1),1e3):(clearInterval(o),o=null)}),()=>{o&&clearInterval(o),n.destroy()}}async function Z(e,t){let n=N(`studio-cards`);n.setAttribute(`data-count`,`1`),n.innerHTML=`
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
  `);let r=new k(N(`studio-scene`));H=r;let i=()=>(r.destroy(),null);r.setAnimationSpeed(75/100);let a=e?await m(P):await v(P);if(!t())return i();let o=ce(e),s=new c(void 0,o),l=le(r,a,W(I,L,R),(e,n)=>{t()&&(N(`timer-state`).textContent=n?`Moving…`:`Ready`)},G);K(N(`studio-scene`),M(t,async e=>{await l.updateManifest(e)}));let u=ue(o);if(await l.configure(u),!t())return i();function d(){let e=s.snapshot();N(`timer-display`).textContent=de(e.bucket,o),N(`timer-toggle-btn`).textContent=s.running?`Pause`:`Start`,N(`timer-status-info`).textContent=s.running?`Counting down…`:`Paused`}let f=new fe({clock:s,controller:l,setDuration:e=>r.setAnimationSpeed(75/e),onError:e=>{t()&&(N(`studio-error`).textContent=e.message)}});N(`timer-toggle-btn`).addEventListener(`click`,()=>{s.running?f.pause():f.start(),d()}),N(`timer-reset-btn`).addEventListener(`click`,()=>{f.reset(),d()}),d();let p=setInterval(d,100),h=setInterval(()=>f.tick(),50);return()=>{clearInterval(p),clearInterval(h),f.dispose(),r.destroy()}}async function Q(e,t){let n=N(`studio-cards`);n.setAttribute(`data-count`,`1`),n.innerHTML=`
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
  `);let r=new k(N(`studio-scene`));H=r;let i=()=>(r.destroy(),null);r.setAnimationSpeed(75/100);let a=e===`ms`?await C(P,p.runtimeSHA256):e===`hm`?await b(P,y.runtimeSHA256):await E(P,o.runtimeSHA256);if(!t())return i();let s=ie(e,r,a,W(I,L,R,z),N(`single-unit-select`).value,(e,n)=>{t()&&(N(`hsm-value-display`).textContent=String(e).padStart(2,`0`),N(`hsm-state`).textContent=n?`Turning…`:`Ready`)},G);if(K(N(`studio-scene`),M(t,async e=>{await s.updateManifest(e)})),await s.configure(0),!t())return i();let c=e=>{let t=(s.currentValue+e+60)%60;s.request(t)};return N(`hsm-plus-1`).addEventListener(`click`,()=>c(1)),N(`hsm-minus-1`).addEventListener(`click`,()=>c(-1)),N(`hsm-plus-10`).addEventListener(`click`,()=>c(10)),N(`hsm-minus-10`).addEventListener(`click`,()=>c(-10)),N(`hsm-reset`).addEventListener(`click`,()=>s.request(0)),()=>{r.destroy()}}var be=oe(e=>{console.error(`Failed to initialize mode:`,e),N(`studio-error`).textContent=`Failed to load mode ${B}: ${e.message}`},e=>console.warn(`Cleanup error:`,e)),xe={clock:e=>ge(e),"ms-timer":e=>_e(e),"hm-clock":e=>ve(e),tenth:e=>ye(e),counter:e=>X(e),timer:e=>Z(!1,e),"five-second-timer":e=>Z(!0,e),"hsm-counter":e=>Q(`hsm`,e),"ms-counter":e=>Q(`ms`,e),"hm-one-cube":e=>Q(`hm`,e)};async function $(e,t=!0){F[e]||(e=`clock`);let n=F[e];await be.switchTo(xe[e],()=>{if(N(`studio-scene`).innerHTML=``,N(`studio-cards`).innerHTML=``,N(`studio-controls`).innerHTML=``,N(`studio-error`).textContent=``,B=e,delete N(`shell`).dataset.modeReady,N(`studio-heading`).textContent=n.title,N(`studio-subtitle`).textContent=n.subtitle,N(`studio-cube-count-badge`).textContent=`${n.count} CUBE${n.count>1?`S`:``}`,N(`studio-mode-label`).textContent=n.badge,N(`studio-application`).value=e,t){let t=new URL(location.href);t.searchParams.set(`mode`,e),history.replaceState(null,``,t),localStorage.setItem(`cubistry_chronocube_mode`,e)}})&&B===e&&(N(`shell`).dataset.modeReady=e)}async function Se(){await he();let e=new URLSearchParams(location.search),t=e.get(`mode`)||localStorage.getItem(`cubistry_chronocube_mode`)||`clock`;N(`studio-application`).addEventListener(`change`,e=>{let t=e.target.value;F[t]?$(t,!0):location.assign(t)}),window.addEventListener(`popstate`,()=>{$(new URLSearchParams(location.search).get(`mode`)||`clock`,!1)}),await $(t,!1);let n=e.get(`presentation`)??e.get(`kiosk`);(n===`1`||n===`true`)&&setTimeout(()=>Y(!0),200)}Se();