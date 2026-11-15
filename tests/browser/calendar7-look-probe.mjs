// SPDX-License-Identifier: AGPL-3.0-or-later
// Real Calendar7 page probe of the look of the names layout under its global light (names-light.ts): per view, the luma profile of
// every cube edge between two visible faces (bevel), the fill color of every visible tile against its scheme token, and the same
// view rendered flat (no directional or hemisphere light, ambient 1: the token itself) as the reference. The numbers are reduced by
// `lookMetrics`. Metric definitions (measured on the production effects, 1500 x 1500 at device scale factor 2):
// - bevel depth: on each of the 2 most visible faces of a view, per cube edge of that face the largest |luma of a bevel sample - luma
//   of the flat face at the end of the profile| on that face's half of the profile, averaged over edges, faces and views (flat render:
//   0.5 luma levels; the per-face weight look of #502: 3.7);
// - bevel violation: an edge whose luma profile leaves [min, max] of its two end faces by more than 6 luma levels (seam artifact);
// - side chroma: LCh chroma of the rendered fill / chroma of the token, on the tiles of the visible faces beyond the 2 most visible
//   (tokens with chroma above 12), averaged; hue error: |hue rendered - hue token| in degrees, averaged;
// - highlight share: share of the sampled pixels of those tiles with luma above 235 and HSV saturation below 0.2; excess = minus the
//   same share of the flat render of the same tile.

export const LOOK_VIEWS = { front: [0, 0], shot: [0.4, -0.45], iso: [0.5, -0.6], p45: [0.45, -0.3] };
const AX = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const EDGES = [];
for (const a of AX) for (const b of AX) if (a.reduce((s, x, i) => s + x * b[i], 0) === 0 && AX.indexOf(a) < AX.indexOf(b)) EDGES.push([a, b]);

/** Renders the view (pitch, rotation y) in the page of `openApp` and measures it; `flat` renders the token reference; `bevels` false skips the edge profiles. */
export function measureLook(page, { pitch, rotY, flat = false, bevels = true }) {
  return page.evaluate(async ({ pitch, rotY, flat, bevels, edges }) => {
    const v = window.__c7viewer, T3 = v.camera.position.constructor;
    const { NAMES_CUBE_EDGE, NAMES_GAP, NAMES_BODY_RADIUS } = await import("/src/apps/calendar7/geometry.ts");
    const { tileRoles } = await import("/src/apps/calendar7/sticker-art.ts");
    const { schemeForHome, usesHomeTints } = await import("/src/apps/calendar7/home-tint.ts");
    const { withBannerStyle } = await import("/src/apps/calendar7/schemes.ts");
    const lights = []; v.scene.traverse((o) => { if (o.isLight) lights.push(o); });
    const saved = lights.map((l) => l.intensity);
    if (flat) for (const l of lights) l.intensity = l.isAmbientLight ? 1 : 0;
    v.presentation.rotation.set(pitch, rotY, 0); v.presentation.updateMatrixWorld(true);
    for (let k = 0; k < 3; k++) { v.syncExposure(); v.renderer.render(v.scene, v.camera); }
    const cv = v.renderer.domElement, copy = document.createElement("canvas"); copy.width = cv.width; copy.height = cv.height;
    const ctx = copy.getContext("2d", { willReadFrequently: true }); ctx.drawImage(cv, 0, 0);
    lights.forEach((l, k) => { l.intensity = saved[k]; }); v.syncExposure();
    const px = (x, y) => { const d = ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data; return [d[0], d[1], d[2], d[3]]; };
    const lum = (p) => 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2];
    const proj = (p) => { const w = v.presentation.localToWorld(new T3(...p)); w.project(v.camera); return [(w.x * 0.5 + 0.5) * cv.width, (1 - (w.y * 0.5 + 0.5)) * cv.height]; };
    const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    const lch = (p) => { const r = lin(p[0]), g = lin(p[1]), b = lin(p[2]); const X = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047, Y = 0.2126 * r + 0.7152 * g + 0.0722 * b, Z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883; const f = (t) => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116; const fx = f(X), fy = f(Y), fz = f(Z); const a = 500 * (fx - fy), bb = 200 * (fy - fz); return { C: Math.hypot(a, bb), h: Math.atan2(bb, a) * 180 / Math.PI }; };
    const hex = (h) => [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16));
    const out = { exposure: v.renderer.toneMappingExposure };
    // ---- bevel profiles: luma along the rounded edge between two faces
    const R = NAMES_BODY_RADIUS, h = NAMES_CUBE_EDGE / 2 - NAMES_GAP / 2, bev = [];
    const read = (p, n) => { const world = v.presentation.localToWorld(new T3(...p)); const nw = new T3(...n).transformDirection(v.presentation.matrixWorld); if (nw.dot(v.camera.position.clone().sub(world).normalize()) < 0.3) return null; const ndc = world.clone().project(v.camera), d = px((ndc.x * 0.5 + 0.5) * cv.width, (1 - (ndc.y * 0.5 + 0.5)) * cv.height); if (d[3] < 250) return null; return Math.round(lum(d)); };
    if (bevels) for (const [a, b] of edges) {
      const samples = [];
      for (let k = 1; k < 30; k++) { const phi = (k / 30) * Math.PI / 2, c = Math.cos(phi), s = Math.sin(phi), n = a.map((x, i) => c * x + s * b[i]), l = read(a.map((x, i) => (h - R) * (x + b[i]) + R * n[i]), n); if (l !== null) samples.push(l); }
      if (samples.length < 8) continue;
      const o = 0.01, start = read(a.map((x, i) => (h - R) * (x + b[i]) + R * a[i] - o * b[i]), a), end = read(a.map((x, i) => (h - R) * (x + b[i]) + R * b[i] - o * a[i]), b);
      bev.push({ a, b, samples, start, end });
    }
    out.bev = bev;
    // ---- tiles of the visible faces
    const NORMALS = { up: [0, 1, 0], down: [0, -1, 0], front: [0, 0, 1], right: [1, 0, 0], left: [-1, 0, 0] };
    const LOCAL = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
    const toCam = v.camera.position.clone().normalize(), rotQ = v.presentation.quaternion, vis = {};
    for (const [f, n] of Object.entries(NORMALS)) vis[f] = new T3(...n).applyQuaternion(rotQ).dot(toCam);
    out.order = Object.entries(vis).filter((e) => e[1] >= 0.2).sort((x, y) => y[1] - x[1]).map((e) => e[0]);
    const sch0 = v.currentScheme, tiles = [];
    v.presentation.traverse((o) => {
      const ids = o.userData.sourceFaceStickerIds; if (!ids || !Array.isArray(o.material)) return;
      for (let fi = 0; fi < 6; fi++) {
        if (ids[fi] == null) continue; const i = ids[fi] - 1;
        o.geometry.computeBoundingBox();
        const m = v.presentation.matrixWorld.clone().invert().multiply(o.matrixWorld), bb = o.geometry.boundingBox.clone().applyMatrix4(m), n = new T3(...LOCAL[fi]).transformDirection(m).toArray().map(Math.round);
        const f = Object.keys(NORMALS).find((k) => NORMALS[k].every((x, k2) => x === n[k2])); if (!f || vis[f] < 0.2) continue;
        const ax = [0, 1, 2].filter((k) => n[k] === 0), pl = n.findIndex((x) => x !== 0), plane = n[pl] > 0 ? bb.max.getComponent(pl) : bb.min.getComponent(pl);
        const corner = (a, b) => { const p = [0, 0, 0]; p[pl] = plane; p[ax[0]] = a; p[ax[1]] = b; return p; };
        const lo = [bb.min.getComponent(ax[0]), bb.min.getComponent(ax[1])], hi = [bb.max.getComponent(ax[0]), bb.max.getComponent(ax[1])], c = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2], s = [(hi[0] - lo[0]) * 0.35, (hi[1] - lo[1]) * 0.35];
        const q = [corner(c[0] - s[0], c[1] - s[1]), corner(c[0] + s[0], c[1] - s[1]), corner(c[0] + s[0], c[1] + s[1]), corner(c[0] - s[0], c[1] + s[1])].map((p) => proj(p));
        const bil = (i2, j) => { const a = [q[0][0] + (q[1][0] - q[0][0]) * i2, q[0][1] + (q[1][1] - q[0][1]) * i2], b = [q[3][0] + (q[2][0] - q[3][0]) * i2, q[3][1] + (q[2][1] - q[3][1]) * i2]; return [a[0] + (b[0] - a[0]) * j, a[1] + (b[1] - a[1]) * j]; };
        const pix = []; for (let a = 0.04; a < 1; a += 0.08) for (let b = 0.04; b < 1; b += 0.08) { const [x, y] = bil(a, b); pix.push(px(x, y)); }
        const bins = new Map(); for (const p of pix) { const key = p.slice(0, 3).map((x) => x >> 4).join(); (bins.get(key) ?? bins.set(key, []).get(key)).push(p); }
        const main = [...bins.values()].sort((a, b) => b.length - a.length)[0], med = (arr) => [...arr].sort((x, y) => x - y)[arr.length >> 1];
        const fill = [0, 1, 2].map((k) => med(main.map((p) => p[k])));
        let sch = withBannerStyle(sch0, "theme"); if (usesHomeTints(v.baseScheme)) sch = withBannerStyle(schemeForHome(v.baseScheme, v.homes[i]), "theme");
        const token = hex(tileRoles(sch, v.printing.text[i], v.printing.ink[i], "names").fill), tl = lch(token), rl = lch(fill);
        let hl = 0; for (const p of pix) { const mx = Math.max(...p.slice(0, 3)), mn = Math.min(...p.slice(0, 3)); if (lum(p) > 235 && (mx ? (mx - mn) / mx : 0) < 0.2) hl++; }
        tiles.push({ f, i, fl: lum(fill), tokC: tl.C, C: rl.C, dh: Math.abs(((rl.h - tl.h + 540) % 360) - 180), hi: hl / pix.length, tok: token.join() });
      }
    });
    out.tiles = tiles;
    return out;
  }, { pitch, rotY, flat, bevels, edges: EDGES });
}

const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const VEC = { up: [0, 1, 0], down: [0, -1, 0], front: [0, 0, 1], right: [1, 0, 0], left: [-1, 0, 0] };
const same = (a, b) => a.every((x, i) => x === b[i]);

/** Bevel depth of one face of a view (see the header): the mean over its edges of the largest deviation of the bevel samples from the face end. */
export function faceBevelDepth(view, face) {
  const dep = [];
  for (const e of view.bev) {
    let side = null; if (same(e.a, VEC[face])) side = "a"; else if (same(e.b, VEC[face])) side = "b"; if (!side) continue;
    const s = e.samples, h = s.length >> 1;
    dep.push(side === "a" ? Math.max(...s.slice(0, h).map((x) => Math.abs(x - (e.start ?? s[0])))) : Math.max(...s.slice(h).map((x) => Math.abs(x - (e.end ?? s[s.length - 1])))));
  }
  return dep.length ? mean(dep) : null;
}

/** Edges that leave the range of their end faces by more than `tol` luma levels. */
export function bevelViolations(view, tol = 6) {
  let violations = 0, worst = 0;
  for (const e of view.bev) {
    const s = e.samples, lo = Math.min(e.start ?? s[0], e.end ?? s[s.length - 1]), hi = Math.max(e.start ?? s[0], e.end ?? s[s.length - 1]);
    const dev = Math.max(lo - Math.min(...s), Math.max(...s) - hi, 0);
    if (dev > tol) violations++;
    worst = Math.max(worst, dev);
  }
  return { violations, worst, edges: view.bev.length };
}

/** `looks` and `flats` map a view name to the result of `measureLook` (without and with `flat`). */
export function lookMetrics(looks, flats) {
  const depth = [], relC = [], hue = [], hi = [], hiExcess = [];
  let violations = 0, worst = 0, edges = 0;
  for (const [name, r] of Object.entries(looks)) {
    for (const face of r.order.slice(0, 2)) { const d = faceBevelDepth(r, face); if (d !== null) depth.push(d); }
    const bv = bevelViolations(r); violations += bv.violations; worst = Math.max(worst, bv.worst); edges += bv.edges;
    const flat = new Map(flats[name].tiles.map((t) => [t.f + ":" + t.i, t]));
    for (const t of r.tiles.filter((x) => r.order.slice(2).includes(x.f) && x.tokC > 12)) {
      relC.push(t.C / t.tokC); hue.push(t.dh); hi.push(t.hi);
      const f = flat.get(t.f + ":" + t.i); if (f) hiExcess.push(t.hi - f.hi);
    }
  }
  return { bevelDepth: mean(depth), bevelViolations: violations, worstDeviation: worst, edges, sideTiles: relC.length, sideChroma: mean(relC), hueError: mean(hue), highlight: mean(hi), highlightExcessPoints: 100 * mean(hiExcess) };
}

/** Largest exposure step in percent, and largest step of the mean tile luma of a face (at least 3 tiles seen in both views), between consecutive views of a sweep. */
export function sweepSteps(sweep) {
  let exposure = 0, face = 0;
  for (let k = 0; k + 1 < sweep.length; k++) {
    exposure = Math.max(exposure, Math.abs(sweep[k + 1].exposure - sweep[k].exposure) / sweep[k].exposure * 100);
    const next = new Map(sweep[k + 1].tiles.map((t) => [t.f + ":" + t.i, t])), byFace = {};
    for (const t of sweep[k].tiles) { const q = next.get(t.f + ":" + t.i); if (q) (byFace[t.f] ??= []).push(q.fl - t.fl); }
    for (const a of Object.values(byFace)) if (a.length >= 3) face = Math.max(face, Math.abs(mean(a)));
  }
  return { exposureStepPercent: exposure, faceStepLuma: face };
}
