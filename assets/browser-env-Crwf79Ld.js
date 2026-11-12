import{i as e}from"./src-Cud8UHPW.js";import{t}from"./src-SzBsgNum.js";import{t as n}from"./pictures-BUVxO-Rt.js";var r=`<h2 class="pg-region-title">Your pictures</h2>
<details id="pictures" class="pictures">
  <summary>Pictures: fit, upload, template</summary>
  <div class="pictures-body">
    <p id="pictures-live" class="sr-only" role="status" aria-live="polite" aria-atomic="true"></p>
    <section aria-labelledby="fit-title" class="pictures-section">
      <div class="control-heading">
        <h2 id="fit-title">How well do the pictures fit?</h2>
        <label>Check fit for size
          <select id="picture-size" aria-describedby="fit-note">
            <option>2</option><option>3</option><option>4</option>
            <option>5</option><option>6</option><option>7</option>
          </select></label>
      </div>
      <div id="fit" class="fit" data-light="none">
        <span id="fit-light" class="light" aria-hidden="true"></span>
        <p id="fit-summary">Open this section to measure the selected design.</p>
      </div>
      <p id="fit-symmetry" class="pictures-note"></p>
      <p id="fit-note" class="pictures-note"></p>
      <ul id="fit-thumbs" class="thumbs" aria-label="Stickers to check"></ul>
      <p class="pictures-note">Marks: flat = mostly one color; same = identical to another sticker; 2-fold, 4-fold = looks the same turned 180° or 90°; twin = a turned copy of another sticker. Only flat stickers are a real problem.</p>
    </section>
    <section aria-labelledby="upload-title" class="pictures-section">
      <div class="control-heading"><h2 id="upload-title">Your own pictures</h2></div>
      <p class="pictures-note">
        PNG or SVG. Choose six face files named F, B, L, R, U and D (for example
        <code>F.png</code>), or one net image in the cross layout (4:3, U above F,
        L F R B in a row, D below F). Files stay in this browser; nothing is uploaded.
      </p>
      <label for="upload-input">Picture files</label>
      <input id="upload-input" type="file" multiple accept=".png,.svg,image/png,image/svg+xml" />
      <div id="upload-net" class="net" role="group" aria-label="Face slots: choose a file or drop one on a slot">
        <button type="button" class="slot" data-face="U" style="grid-area: 1 / 2"></button>
        <button type="button" class="slot" data-face="L" style="grid-area: 2 / 1"></button>
        <button type="button" class="slot" data-face="F" style="grid-area: 2 / 2"></button>
        <button type="button" class="slot" data-face="R" style="grid-area: 2 / 3"></button>
        <button type="button" class="slot" data-face="B" style="grid-area: 2 / 4"></button>
        <button type="button" class="slot" data-face="D" style="grid-area: 3 / 2"></button>
      </div>
      <input id="slot-input" type="file" accept=".png,.svg,image/png,image/svg+xml" hidden tabindex="-1" />
      <p id="upload-status" class="pictures-status"></p>
      <p id="upload-resolution" class="pictures-note"></p>
      <button type="button" id="upload-clear" class="quiet" hidden>Remove my pictures</button>
    </section>
    <section aria-labelledby="template-title" class="pictures-section">
      <div class="control-heading"><h2 id="template-title">Blank net template</h2></div>
      <p class="pictures-note" id="template-note"></p>
      <div class="history-actions">
        <button type="button" id="template-png">Download PNG</button>
        <button type="button" id="template-svg">Download SVG</button>
      </div>
    </section>
  </div>
</details>`;function i(e,t){return e.innerHTML=r,n({...t,root:e})}function a(n){return{doc:document,createViewer:e=>new t(e),baseMoveMs:75,loadAssets:(t,r)=>e(t.assets,[t.print],void 0,n,r),createPictures:(e,t)=>i(e,{baseUrl:n,...t}),keys:window,replaceParams(e,t){let n=new URL(location.href);for(let e of t)n.searchParams.delete(e);for(let[t,r]of e)n.searchParams.set(t,r);history.replaceState(history.state,``,n.pathname+n.search+n.hash)},nextFrame:e=>void requestAnimationFrame(e)}}export{a as browserPlaygroundEnv};