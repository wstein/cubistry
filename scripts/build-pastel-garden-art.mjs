/** Original "Pastel Garden" vector illustrations and original characters, copyright 2026 Cubistry contributors.
 * Distributed under the repository's AGPL-3.0-or-later license. No fonts, characters,
 * third-party images or trademarked assets; every shape is drawn here.
 * Rebuild: node scripts/build-pastel-garden-art.mjs
 * Characters (Pip, Nimbo, Tulia, Moss, Sunny, Plop) are original inventions, deliberately not
 * modeled on any licensed character. Draft artwork: not wired into the playground and not a physical-feasibility claim.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
const dir = new URL("../public/playground-pastel/", import.meta.url);
mkdirSync(dir, { recursive: true });


// ---- Style guide ---------------------------------------------------------
// One ink color, three line weights, and six hues with four tones each.
// Flat vector only: no blur filters or gradients, so print output stays predictable.
const ink = "#4a3a38"; // soft brown line work
const W = { outline: 3, fine: 2, body: 6 }; // body = merged outline (half is covered, 3 shows)
const H = {
  butter: { bg: "#fdf1cf", light: "#fff4c2", mid: "#fbe08a", dark: "#f0c45a" },
  peach: { bg: "#fbe0c8", light: "#f8d5b8", mid: "#f6b98c", dark: "#e79c6c" },
  pink: { bg: "#fbdde4", light: "#f9c6d3", mid: "#f4a9bd", dark: "#e8788f" },
  green: { bg: "#e2efd9", light: "#bfe6d4", mid: "#9cc08a", dark: "#6f9f6b" },
  sky: { bg: "#d6ecf5", light: "#c9dcf2", mid: "#a9c1e6", dark: "#8fb0dd", aqua: "#cfeaee", water: "#a9dcdf", waterDk: "#8ccdd3" },
  lilac: { bg: "#ece4f8", light: "#d8ccf2", mid: "#b9a8e2", dark: "#9a86d0" },
};
const white = "#fffaf1";
const twig = "#8a6a4f";
const strokeW = (w = W.outline, c = ink) =>
  `fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;
const stroke = strokeW();
const petals = (cx, cy, r, n, fill, rot = 0) =>
  Array.from({ length: n }, (_, i) => {
    const a = rot + (360 / n) * i;
    return `<ellipse cx="${cx}" cy="${cy - r}" rx="${r * 0.45}" ry="${r * 0.8}" fill="${fill}" stroke="${ink}" stroke-width="${W.outline}" transform="rotate(${a} ${cx} ${cy})"/>`;
  }).join("");
const leafShape = (x, y, rot, s = 1) =>
  `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})"><path d="M0 0C14-30 46-30 62 0C46 30 14 30 0 0Z" fill="${H.green.mid}" stroke="${ink}" stroke-width="${W.outline}"/><path d="M4 0H54" ${strokeW(W.fine)}/></g>`;
const dot = (x, y, r, c) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" stroke="${ink}" stroke-width="${W.outline}"/>`;

// merged(): outline all shapes, then fill, so overlapping parts read as one flat body.
const merged = (shapes, fill) =>
  `<g stroke="${ink}" stroke-width="${W.body}" stroke-linejoin="round" fill="${ink}">${shapes}</g><g fill="${fill}">${shapes}</g>`;
// shaded(): merged body plus a two-tone shadow crescent (lower right) and a soft highlight.
// Clip-free (the playground SVG validator allows no clipPath/url()): a shade-colored body is
// covered by a slightly smaller, up-left-shifted copy in the base color, scaled about the
// body center c so it stays inside the silhouette.
const shaded = (shapes, base, shade, hl = "", c = [160, 200], k = 0.9, off = [-5, -5]) =>
  `<g stroke="${ink}" stroke-width="${W.body}" stroke-linejoin="round" fill="${ink}">${shapes}</g><g fill="${shade}">${shapes}</g><g fill="${base}" transform="translate(${(c[0] - k * c[0] + off[0]).toFixed(1)} ${(c[1] - k * c[1] + off[1]).toFixed(1)}) scale(${k})">${shapes}</g>${hl}`;
const shine = (x, y, rx = 12, ry = 7, rot = -35) =>
  `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="#fff" opacity=".5" transform="rotate(${rot} ${x} ${y})"/>`;

// Faces: shared helpers for expressions.
const eye = (x, y, r = 4.5) =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="${ink}"/><circle cx="${x + 1.5}" cy="${y - 1.5}" r="${r * 0.3}" fill="#fff"/>`;
const sleepyEye = (x, y) => `<path d="M${x - 7} ${y}Q${x} ${y + 7} ${x + 7} ${y}" ${strokeW(2.5)}/>`;
const smile = (x, y, w = 8) => `<path d="M${x - w} ${y}Q${x} ${y + w} ${x + w} ${y}" ${strokeW(2.5)}/>`;
const cheeks = (x, y, gap, c = H.pink.dark) =>
  `<ellipse cx="${x - gap}" cy="${y}" rx="7" ry="4.5" fill="${c}" opacity=".55"/><ellipse cx="${x + gap}" cy="${y}" rx="7" ry="4.5" fill="${c}" opacity=".55"/>`;
const happy = (x, y) => eye(x - 17, y) + eye(x + 17, y) + cheeks(x, y + 10, 27) + smile(x, y + 8);
const sleepy = (x, y) => sleepyEye(x - 17, y) + sleepyEye(x + 17, y) + cheeks(x, y + 10, 27) + smile(x, y + 10, 6);

// ---- Scenery and small critters (original, flat vector) -------------------
const g = (x, y, s, inner) => `<g transform="translate(${x} ${y}) scale(${s})">${inner}</g>`;
const o = `stroke="${ink}" stroke-width="${W.fine}"`;
const butterfly = (x, y, c1, c2, s = 1) =>
  g(x, y, s, `<ellipse cx="-9" cy="-6" rx="10" ry="8" fill="${c1}" ${o} transform="rotate(-25 -9 -6)"/><ellipse cx="9" cy="-6" rx="10" ry="8" fill="${c1}" ${o} transform="rotate(25 9 -6)"/><ellipse cx="-7" cy="7" rx="7" ry="6" fill="${c2}" ${o}/><ellipse cx="7" cy="7" rx="7" ry="6" fill="${c2}" ${o}/><path d="M0 -9V10" ${strokeW(3)}/><path d="M0 -9Q-4 -17 -8 -17M0 -9Q4 -17 8 -17" ${strokeW(W.fine)}/>`);
const bee = (x, y, s = 1) =>
  g(x, y, s, `<ellipse cx="-4" cy="-9" rx="6" ry="4" fill="#fff" ${o} transform="rotate(-25 -4 -9)"/><ellipse cx="5" cy="-9" rx="6" ry="4" fill="#fff" ${o} transform="rotate(25 5 -9)"/><ellipse rx="12" ry="8" fill="${H.butter.mid}" ${o}/><path d="M-3 -7V7M4 -7V7" ${strokeW(2.5)}/><circle cx="-8" cy="-1" r="1.7" fill="${ink}"/>`);
const ladybug = (x, y, s = 1) =>
  g(x, y, s, `<circle r="9" fill="${H.pink.dark}" ${o}/><path d="M-6 -7a8 8 0 0 1 12 0Z" fill="${ink}"/><path d="M0 -7V9" ${strokeW(W.fine)}/><circle cx="-4" cy="1" r="1.8" fill="${ink}"/><circle cx="4" cy="2" r="1.8" fill="${ink}"/>`);
const mushroom = (x, y, s = 1, cap = H.pink.dark) =>
  g(x, y, s, `<path d="M-7 0V-14H7V0Q0 4 -7 0Z" fill="${white}" ${o}/><path d="M-20 -14A20 16 0 0 1 20 -14Z" fill="${cap}" ${o}/><circle cx="-8" cy="-22" r="3" fill="#fff"/><circle cx="6" cy="-26" r="2.5" fill="#fff"/><circle cx="12" cy="-19" r="2" fill="#fff"/>`);
const snail = (x, y, s = 1, shell = H.lilac.mid) =>
  g(x, y, s, `<ellipse cx="2" cy="-5" rx="24" ry="6" fill="${H.peach.light}" ${o}/><path d="M24 -8V-20M29 -8L34 -18" ${strokeW(W.fine)}/><circle cx="-4" cy="-16" r="13" fill="${shell}" ${o}/><path d="M-4 -16a4 4 0 1 1 4 4a8 8 0 1 1-8-8" ${strokeW(W.fine)}/>`);
const bird = (x, y, c, s = 1, flip = 1) =>
  g(x, y, s, `<g transform="scale(${flip} 1)"><path d="M-10 0L-20 -5L-18 4Z" fill="${c}" ${o}/><ellipse rx="12" ry="8.5" fill="${c}" ${o}/><circle cx="9" cy="-6" r="6.5" fill="${c}" ${o}/><path d="M14 -7L21 -4L14 -2Z" fill="${H.peach.dark}" ${o}/><ellipse cx="-2" cy="2" rx="6" ry="4" fill="${H.pink.light}" ${o} opacity=".8"/><circle cx="10" cy="-7" r="1.6" fill="${ink}"/></g>`);
const fish = (x, y, s = 1, c = H.peach.mid) =>
  g(x, y, s, `<path d="M-13 0L-25 -8V8Z" fill="${c}" ${o}/><ellipse rx="15" ry="9" fill="${c}" ${o}/><path d="M-2 -8Q4 -15 8 -8" fill="${H.peach.dark}" ${o}/><circle cx="8" cy="-2" r="2" fill="${ink}"/><path d="M13 3Q10 5 8 4" ${strokeW(W.fine)}/>`);
const dragonfly = (x, y, s = 1) =>
  g(x, y, s, `<ellipse cx="-4" cy="-8" rx="13" ry="4.5" fill="#fff" opacity=".8" ${o} transform="rotate(-18 -4 -8)"/><ellipse cx="-4" cy="6" rx="13" ry="4.5" fill="#fff" opacity=".8" ${o} transform="rotate(18 -4 6)"/><path d="M-14 0H20" ${strokeW(4, H.lilac.dark)}/><circle cx="22" cy="0" r="4" fill="${H.lilac.dark}" ${o}/>`);
const balloon = (x, y, s = 1) =>
  g(x, y, s, `<path d="M-12 24L-8 42M12 24L8 42" ${strokeW(W.fine)}/><rect x="-10" y="42" width="20" height="13" rx="3" fill="${H.peach.mid}" ${o}/><circle r="26" fill="${H.pink.mid}" ${o}/><path d="M0 -26C-14 -10 -14 10 0 26C14 10 14 -10 0 -26Z" fill="${H.butter.mid}" ${o}/>`);
const pine = (x, y, s = 1, c = H.green.mid) =>
  g(x, y, s, `<rect x="-4" y="22" width="8" height="12" fill="${twig}" ${o}/><path d="M0 -52L-16 -24H-8L-22 -2H-10L-26 22H26L10 -2H22L8 -24H16Z" fill="${c}" ${o} stroke-linejoin="round"/>`);
const reeds = (x, y, s = 1) =>
  g(x, y, s, `<path d="M-10 0Q-12 -30 -9 -58M2 0Q4 -34 1 -72M13 0Q16 -26 13 -50" ${strokeW(W.outline, H.green.dark)}/><ellipse cx="-9" cy="-60" rx="4.5" ry="11" fill="${twig}" ${o}/><ellipse cx="1" cy="-74" rx="4.5" ry="11" fill="${twig}" ${o}/><ellipse cx="13" cy="-52" rx="4.5" ry="10" fill="${twig}" ${o}/>`);
const house = (x, y, s = 1) =>
  g(x, y, s, `<path d="M-14 0V-26H14V0Z" fill="${white}" ${o}/><path d="M-30 -26A30 24 0 0 1 30 -26Z" fill="${H.pink.mid}" ${o}/><circle cx="-12" cy="-38" r="3.5" fill="#fff"/><circle cx="10" cy="-42" r="3" fill="#fff"/><rect x="-6" y="-20" width="12" height="12" rx="6" fill="${H.butter.mid}" ${o}/>`);
const plane = (x, y, s = 1) =>
  g(x, y, s, `<path d="M0 0L46 -14L20 12Z" fill="${white}" ${o} stroke-linejoin="round"/><path d="M0 0L20 12L16 2Z" fill="${H.sky.mid}" ${o} stroke-linejoin="round"/>`);
const tulip = (x, y, s = 1, c = H.pink.mid) =>
  g(x, y, s, `<path d="M0 0V-34" ${strokeW(W.outline)}/><path d="M-9 -34C-10 -48 -4 -54 0 -58C4 -54 10 -48 9 -34Q0 -28 -9 -34Z" fill="${c}" ${o}/>`);
const tuft = (x, y, c = H.green.dark) =>
  `<path d="M${x} ${y}q-4-14-10-18M${x} ${y}q0-18 2-24M${x} ${y}q4-14 12-16" ${strokeW(W.outline, c)}/>`;
const star = (x, y, r, c = H.butter.light) => {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (Math.PI * i) / 5, d = i % 2 ? r * 0.45 : r;
    return `${(x + Math.cos(a) * d).toFixed(1)} ${(y + Math.sin(a) * d).toFixed(1)}`;
  });
  return `<path d="M${pts.join("L")}Z" fill="${c}" stroke="${ink}" stroke-width="${W.fine}" stroke-linejoin="round"/>`;
};
const cloud = (x, y, s = 1, fill = white) =>
  g(x, y, s, `<path transform="translate(-30 -80)" d="M30 80Q14 50 48 48Q58 18 88 36Q118 30 124 58Q148 74 122 82H46Q32 86 30 80Z" fill="${fill}" stroke="${ink}" stroke-width="${W.outline}"/>`);
const hill = (d, fill, line = false) =>
  `<path d="${d}" fill="${fill}"${line ? ` stroke="${ink}" stroke-width="${W.outline}"` : ""}/>`;
const glow = (x, y, r = 4) => `<circle cx="${x}" cy="${y}" r="${r * 2.4}" fill="${H.butter.mid}" opacity=".35"/><circle cx="${x}" cy="${y}" r="${r}" fill="${H.butter.light}" stroke="${ink}" stroke-width="${W.fine}"/>`;

// More expressions for personality.
const arcEye = (x, y) => `<path d="M${x - 6} ${y + 3}Q${x} ${y - 6} ${x + 6} ${y + 3}" ${strokeW(2.5)}/>`;
const laugh = (x, y) =>
  `<path d="M${x - 10} ${y}Q${x} ${y + 2} ${x + 10} ${y}Q${x} ${y + 18} ${x - 10} ${y}Z" fill="${H.pink.dark}" stroke="${ink}" stroke-width="2.5" stroke-linejoin="round"/>`;
const oMouth = (x, y) => `<ellipse cx="${x}" cy="${y + 4}" rx="4.5" ry="6" fill="${H.pink.dark}" stroke="${ink}" stroke-width="2.5"/>`;
const sparkleEye = (x, y) =>
  `<circle cx="${x}" cy="${y}" r="6.5" fill="${ink}"/><circle cx="${x + 2}" cy="${y - 2.5}" r="2.4" fill="#fff"/><circle cx="${x - 2}" cy="${y + 2}" r="1.2" fill="#fff"/>`;
const bubble = (x, y, r) =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" opacity=".6" stroke="${ink}" stroke-width="${W.fine}"/><path d="M${x - r * 0.55} ${y - r * 0.1}a${r * 0.55} ${r * 0.55} 0 0 1 ${r * 0.45} -${r * 0.45}" ${strokeW(1.5, "#fff")}/>`;
const arm = (x, y, rot, rx = 11, ry = 18) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" transform="rotate(${rot} ${x} ${y})"/>`;

// ---- Original characters -------------------------------------------------
// Pip: round peach sprout-sprite with leaf ears. Waters the flower and waves hello.
const pip = (() => {
  const body = `<ellipse cx="190" cy="222" rx="68" ry="58"/><ellipse cx="156" cy="276" rx="20" ry="12"/><ellipse cx="224" cy="276" rx="20" ry="12"/>${arm(128, 216, 50)}${arm(257, 190, 30)}`;
  const can = g(110, 196, 1, `<g transform="rotate(-15)"><path d="M-12 2L-28 12" ${strokeW(4)}/><ellipse cx="-29" cy="13" rx="3" ry="5" fill="${H.sky.dark}" ${o}/><path d="M12 -5Q24 -2 12 9" ${strokeW(W.outline)}/><rect x="-12" y="-10" width="24" height="20" rx="5" fill="${H.sky.mid}" ${o}/><path d="M-8 -4H8" ${strokeW(W.fine, "#fff")}/></g>`);
  const drops = [[78, 218, 3], [74, 232, 2.6], [84, 242, 2.2]].map(([x, y, r]) => `<path d="M${x} ${y - r * 1.8}Q${x + r} ${y} ${x} ${y + r}Q${x - r} ${y} ${x} ${y - r * 1.8}Z" fill="${H.sky.mid}" ${o}/>`).join("");
  return `${leafShape(168, 176, -125, 0.55)}${leafShape(212, 176, -55, 0.55)}${shaded(body, H.peach.light, H.peach.mid, shine(160, 190, 16, 9), [190, 222])}${arcEye(173, 210)}${arcEye(207, 210)}${cheeks(190, 224, 27)}${laugh(190, 222)}${can}${drops}`;
})();
// Nimbo: lilac cloud-puff with a star antenna, hugging a star plush while dreaming.
const nimbo = (() => {
  const body = `<circle cx="130" cy="215" r="38"/><circle cx="178" cy="196" r="50"/><circle cx="224" cy="218" r="36"/><ellipse cx="177" cy="236" rx="76" ry="30"/>`;
  const plush = star(178, 250, 27, H.butter.mid) + `<circle cx="170" cy="252" r="2" fill="${ink}"/><circle cx="186" cy="252" r="2" fill="${ink}"/><path d="M173 258Q178 262 183 258" ${strokeW(1.6)}/>`;
  return `<path d="M178 150V122" ${stroke}/>${star(178, 106, 14)}${shaded(body, H.lilac.light, H.lilac.mid, shine(150, 170, 18, 9), [177, 220])}${sleepy(178, 205)}${plush}${merged(arm(142, 252, 80, 9, 15) + arm(214, 252, -80, 9, 15), H.lilac.light)}${bubble(236, 162, 5)}${bubble(250, 142, 7)}${bubble(268, 116, 10)}`;
})();
// Tulia: mint round creature wearing a tulip bud; delighted, with a bouquet and a butterfly friend.
const tulia = (() => {
  const body = `<circle cx="160" cy="222" r="62"/><ellipse cx="124" cy="282" rx="18" ry="11"/><ellipse cx="196" cy="282" rx="18" ry="11"/>${arm(104, 236, 25)}${arm(216, 238, -30)}`;
  const bouquet = `${tulip(230, 240, 0.5, H.butter.mid)}${tulip(244, 244, 0.45, H.lilac.mid)}`;
  return `${shaded(body, H.green.light, H.green.mid, shine(130, 185, 16, 9), [160, 222])}<path d="M138 156C136 132 150 120 160 112C170 120 184 132 182 156Q160 170 138 156Z" fill="${H.pink.dark}" stroke="${ink}" stroke-width="${W.outline}"/>${butterfly(184, 108, H.sky.mid, H.lilac.light, 0.7)}${sparkleEye(143, 218)}${sparkleEye(177, 218)}${cheeks(160, 230, 29)}${oMouth(160, 226)}${bouquet}`;
})();
// Moss: butter bean with twig antlers and soft ears; carries a glowing lantern and laughs.
const moss = (() => {
  const body = `<ellipse cx="172" cy="214" rx="54" ry="76"/><ellipse cx="136" cy="296" rx="18" ry="10"/><ellipse cx="208" cy="296" rx="18" ry="10"/><ellipse cx="124" cy="176" rx="12" ry="22" transform="rotate(-35 124 176)"/><ellipse cx="220" cy="176" rx="12" ry="22" transform="rotate(35 220 176)"/>${arm(126, 242, 20, 10, 18)}${arm(220, 244, -20, 10, 18)}`;
  const lantern = `<circle cx="112" cy="262" r="26" fill="${H.butter.mid}" opacity=".35"/>` + g(112, 262, 1, `<path d="M-8 -12Q0 -26 8 -12" ${strokeW(W.fine)}/><rect x="-9" y="-13" width="18" height="5" rx="2" fill="${twig}" ${o}/><rect x="-9" y="-8" width="18" height="20" rx="4" fill="${H.butter.light}" ${o}/><rect x="-9" y="10" width="18" height="5" rx="2" fill="${twig}" ${o}/><circle cy="2" r="3.5" fill="${H.butter.mid}"/>`);
  return `<path d="M152 140Q146 112 128 98M148 118L168 100M192 140Q198 112 216 98M196 118L176 100" ${strokeW(4, twig)}/>${shaded(body, H.butter.mid, H.butter.dark, shine(150, 170, 14, 9), [172, 214])}${arcEye(155, 192)}${arcEye(189, 192)}${cheeks(172, 204, 27)}${laugh(172, 200)}${lantern}${glow(236, 206, 3)}`;
})();
// Sunny: sunshine puff with petal rays; winks, with a small bird perched on top.
const sunny = (() => {
  const rays = Array.from({ length: 10 }, (_, i) => {
    const a = (Math.PI * 2 * i) / 10;
    return `<circle cx="${160 + Math.cos(a) * 62}" cy="${170 + Math.sin(a) * 62}" r="15"/>`;
  }).join("");
  return `${shaded(rays + `<circle cx="160" cy="170" r="52"/>` + arm(238, 158, -40, 10, 17), H.butter.mid, H.butter.dark, shine(135, 142, 18, 9), [160, 170])}${eye(143, 164)}${arcEye(177, 164)}${cheeks(160, 176, 27)}${laugh(160, 172)}${bird(160, 104, H.lilac.mid, 0.8)}`;
})();
// Plop: pink pond-sprite peeking out of the water with a lily-pad hat; astonished, blowing bubbles.
const plop = (() => {
  const body = `<circle cx="160" cy="205" r="56"/><ellipse cx="92" cy="226" rx="12" ry="18" transform="rotate(-30 92 226)"/><ellipse cx="228" cy="226" rx="12" ry="18" transform="rotate(30 228 226)"/>`;
  return `${shaded(body, H.pink.mid, H.pink.dark, shine(135, 170, 14, 8), [160, 205])}<ellipse cx="160" cy="152" rx="36" ry="12" fill="${H.green.mid}" stroke="${ink}" stroke-width="${W.outline}"/><path d="M160 152l14-6" ${strokeW(W.fine)}/>${petals(176, 146, 6, 5, H.pink.light, 0)}${sparkleEye(143, 196)}${sparkleEye(177, 196)}${cheeks(160, 208, 29, H.pink.dark)}${oMouth(160, 204)}${bubble(206, 190, 7)}${bubble(224, 166, 10)}${bubble(238, 134, 13)}<path d="M0 238Q40 220 80 238T160 238T240 238T320 238V320H0Z" fill="${H.sky.water}" stroke="${ink}" stroke-width="${W.outline}"/><path d="M0 280Q50 262 100 280T200 280T320 276V320H0Z" fill="${H.sky.waterDk}"/>`;
})();

// ---- Story pass: one day-night cycle around the four side faces ------------
// Net reading order F -> R -> B -> L -> (F): dawn (L), day (F and R), night (B).
// All four share the same ground profile and garden path at every shared edge
// (far hill y=226, mid hill y=262, path y=302), so the scene is continuous when assembled.
const belt = (farFill, midFill, dv = 0, mv = 0) =>
  hill(`M0 226Q80 ${196 + dv} 170 ${222 - dv / 2}T320 226V320H0Z`, farFill) +
  hill(`M0 262Q90 ${236 + mv} 190 ${260 - mv / 2}T320 262V320H0Z`, midFill, true);
const gardenPath = `<path d="M0 302Q80 288 160 304T320 302" fill="none" stroke="${ink}" stroke-width="20"/><path d="M0 302Q80 288 160 304T320 302" fill="none" stroke="${H.peach.light}" stroke-width="14"/>`;
const sunDisc = (x, y, r, c) =>
  Array.from({ length: 8 }, (_, i) => {
    const a = (Math.PI * i) / 4;
    return `<path d="M${(x + Math.cos(a) * (r + 5)).toFixed(1)} ${(y + Math.sin(a) * (r + 5)).toFixed(1)}L${(x + Math.cos(a) * (r + 11)).toFixed(1)} ${(y + Math.sin(a) * (r + 11)).toFixed(1)}" ${strokeW(3, c)}/>`;
  }).join("") + `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" stroke="${ink}" stroke-width="${W.outline}"/>`;
// Dotted butterfly trail as explicit dots along a quadratic curve (the validator allows no
// stroke-dasharray). F ends at (320,104) and R starts at (0,104).
const dotted = (p0, c, p1, n) =>
  Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n, u = 1 - t;
    const x = u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0];
    const y = u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1];
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.8" fill="${H.peach.dark}"/>`;
  }).join("");

const drawings = {
  // FRONT (day, Sunny): TL rainbow+cloud, TR bird+butterfly trail, BL balloon+mushroom, BR paper plane+snail.
  // Sunny waves at Pip (right); the sun rose on the left face, and a butterfly trail leads to Pip's flower.
  F: `<rect width="320" height="320" fill="${H.sky.bg}"/>${["pink", "butter", "green", "sky"].map((k, i) => `<path d="M${14 + i * 7} 150A${50 - i * 7} ${50 - i * 7} 0 0 1 ${114 - i * 7} 150" fill="none" stroke="${H[k].mid}" stroke-width="7"/>`).join("")}${cloud(60, 66, 0.9)}${bird(258, 62, H.pink.mid, 1.2, -1)}${cloud(286, 130, 0.5, H.sky.light)}${dotted([196, 138], [258, 98], [320, 104], 14)}${belt(H.green.light, H.green.mid, 4, 0)}${gardenPath}${balloon(56, 192, 0.7)}${plane(240, 214, 1.1)}${mushroom(36, 296, 1.1)}${tuft(60, 312)}${tuft(300, 308)}${snail(284, 300, 0.9)}${g(0, -26, 1, sunny)}`,
  // BACK (night): TL shooting star+cloud, TR moon, BL pine+fireflies, BR mushroom house. Nimbo sleeps near Moss's lantern light.
  B: `<rect width="320" height="320" fill="${H.sky.light}"/>${star(60, 66, 15)}<path d="M120 40Q96 56 70 92" ${strokeW(W.outline, H.butter.mid)}/>${star(40, 130, 6)}${cloud(78, 124, 0.7, H.lilac.bg)}${star(118, 98, 9)}${star(26, 92, 5)}<path transform="translate(40 -20)" d="M215 45a50 50 0 1 0 48 70a40 40 0 1 1-48-70Z" fill="${H.butter.light}" stroke="${ink}" stroke-width="${W.outline}"/>${star(210, 60, 7)}${star(290, 150, 5)}${hill("M0 226L70 168L130 222L200 150L270 222L320 226V320H0Z", H.sky.mid)}${hill("M0 262Q90 244 190 260T320 262V320H0Z", H.sky.dark, true)}${gardenPath}${pine(40, 258, 0.9, H.sky.dark)}${pine(78, 272, 0.6, H.sky.dark)}${glow(30, 188)}${glow(96, 214, 3)}${glow(314, 198, 3)}${house(280, 296, 0.75)}${g(20, 0, 1, nimbo)}`,
  // RIGHT (day garden, Pip): TL bee+flower+butterfly, TR sun+cloud, BL mushroom, BR snail. Pip waves toward Nimbo (right).
  // The butterfly trail from the front face ends on the flower.
  R: `<rect width="320" height="320" fill="${H.butter.bg}"/>${cloud(170, 72, 0.55)}${sunDisc(270, 46, 18, H.butter.mid)}${belt(H.green.light, H.green.mid, 4, 0)}${gardenPath}<path d="M90 150V290" ${stroke}/>${leafShape(90, 285, -140, 1)}${petals(90, 105, 36, 6, H.peach.mid, 15)}<circle cx="90" cy="105" r="14" fill="${H.butter.mid}" stroke="${ink}" stroke-width="${W.outline}"/>${bee(34, 52, 1.1)}${dotted([0, 104], [14, 106], [34, 104], 4)}${butterfly(50, 106, H.pink.mid, H.peach.mid, 1)}${mushroom(36, 296, 1.1)}${tuft(60, 312)}${tuft(300, 308)}${pip}${snail(284, 300, 0.9)}`,
  // LEFT (dawn): TL ladybug leaf, TR bird on branch, BL mushrooms, BR stones+clover. Moss's lantern lights Nimbo's side (left edge).
  L: `<rect width="320" height="320" fill="${H.green.bg}"/>${sunDisc(298, 224, 24, H.peach.mid)}${pine(250, 238, 1.5, H.green.light)}${pine(30, 250, 1.2, H.green.light)}${belt(H.green.light, H.green.mid, 8, 4)}${gardenPath}<path d="M-10 90Q90 70 200 20" ${stroke}/>${leafShape(30, 82, -75, 0.8)}${leafShape(90, 70, 60, 0.8)}${leafShape(150, 50, -70, 0.8)}${ladybug(44, 56, 1.1)}${bird(214, 22, H.peach.mid, 1.1, -1)}${dot(285, 120, 7, H.butter.mid)}${dot(60, 160, 6, H.pink.mid)}${glow(6, 198, 3)}${mushroom(30, 296, 1.2)}${mushroom(64, 304, 0.8, H.peach.dark)}${tuft(120, 312)}${g(-30, 0, 1, moss)}${dot(276, 298, 5, H.pink.mid)}${dot(292, 306, 4, H.butter.mid)}<ellipse cx="258" cy="306" rx="12" ry="6" fill="${H.lilac.light}" ${o}/><ellipse cx="300" cy="238" rx="8" ry="5" fill="${H.lilac.light}" ${o}/>`,
  // UP (dusk meadow, Tulia): TL pink butterfly, TR bluebird, BL bee+tulips, BR ladybug.
  U: `<rect width="320" height="320" fill="${H.pink.bg}"/>${sunDisc(292, 214, 26, H.peach.mid)}${belt(H.lilac.light, H.green.mid, -6, 2)}<path d="M40 320V210" ${stroke}/>${leafShape(40, 295, -60, 0.9)}<path d="M20 210C18 175 32 160 40 152C50 160 62 175 60 210Q40 224 20 210Z" fill="${H.peach.light}" stroke="${ink}" stroke-width="${W.outline}"/>${butterfly(62, 92, H.pink.mid, H.peach.mid, 1.2)}${bird(262, 76, H.sky.mid, 1.1, -1)}${dot(255, 126, 5, H.butter.mid)}${tulip(92, 304, 0.7, H.butter.mid)}${tulip(236, 308, 0.7, H.lilac.mid)}${bee(80, 196, 1)}${tulia}${ladybug(282, 296, 1.1)}`,
  // DOWN: pond. TL dragonfly, TR lily pad, BL fish, BR reeds + bubbles.
  D: `<rect width="320" height="320" fill="${H.sky.aqua}"/><path d="M0 60Q80 30 160 60T320 60" fill="none" stroke="${H.sky.water}" stroke-width="8" stroke-linecap="round"/>${dragonfly(58, 74, 1.1)}<ellipse cx="60" cy="128" rx="20" ry="5" fill="none" stroke="${H.sky.water}" stroke-width="3"/><path d="M240 120a36 28 0 1 0 64 -22L272 116Z" fill="${H.green.mid}" stroke="${ink}" stroke-width="${W.outline}"/>${petals(270, 100, 16, 5, H.pink.mid, 0)}<circle cx="270" cy="100" r="6" fill="${H.butter.mid}" stroke="${ink}" stroke-width="${W.fine}"/>${plop}${fish(52, 288, 1.1)}${reeds(292, 296, 1)}${dot(240, 262, 5, "#fff")}${dot(256, 248, 3.5, "#fff")}`,
};

const images = [];
for (const [face, shapes] of Object.entries(drawings)) {
  const svg = (viewBox, width) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${width}" viewBox="${viewBox}">${shapes}</svg>\n`;
  writeFileSync(new URL(`${face}.svg`, dir), svg("0 0 320 320", 320));
  for (let row = 0; row < 2; row++)
    for (let col = 0; col < 2; col++) {
      const id = `${face}_${row}_${col}`;
      const source = svg(`${col * 160} ${row * 160} 160 160`, 160);
      writeFileSync(new URL(`${id}.svg`, dir), source);
      images.push({
        id,
        kind: "image",
        format: "svg",
        url: `/playground-pastel/${id}.svg`,
        sha256: createHash("sha256").update(source).digest("hex"),
      });
    }
}
writeFileSync(
  new URL("manifest.json", dir),
  JSON.stringify({ design: "pastel-garden-friends", images: images.map(({ id, sha256 }) => ({ id, sha256 })) }, null, 2) + "\n",
);
writeFileSync(
  new URL("../src/apps/playground/pastel-assets.ts", import.meta.url),
  `// Generated by scripts/build-pastel-garden-art.mjs; original AGPL-3.0-or-later art.\nimport type { ImageAsset } from "@cubistry/cube-assets";\nexport const pastelImages: readonly ImageAsset[] = ${JSON.stringify(images, null, 2)};\n`,
);

// Unfolded-cross preview (assembly reference only).
const pos = { U: [1, 0], L: [0, 1], F: [1, 1], R: [2, 1], B: [3, 1], D: [1, 2] };
const net = Object.entries(pos)
  .map(([f, [c, r]]) => `<svg x="${c * 330 + 10}" y="${r * 330 + 10}" width="320" height="320" viewBox="0 0 320 320" overflow="hidden">${drawings[f]}<rect width="320" height="320" fill="none" stroke="${ink}" stroke-width="2"/></svg>`)
  .join("");
writeFileSync(new URL("net.svg", dir), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1330 1000" width="1330" height="1000"><rect width="1330" height="1000" fill="#f5f3eb"/>${net}</svg>\n`);

// ---- Proposals: alternative Up (sky) and Down (meadow) faces ----------------
// The four side faces form one continuous landscape. Up and Down are designed around it:
// every edge of a proposal starts in the exact color of the neighboring face at that edge and
// steps (flat bands, no gradients) toward a lighter center. Adjacent edges in the net:
//   Up:   bottom = F top, top = B top, left = L top, right = R top.
//   Down: top = F bottom, bottom = B bottom, left = L bottom, right = R bottom.
const mix = (a, b, t) => {
  const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return "#" + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join("");
};
const edgeField = (e, center) => {
  const poly = {
    bottom: (d) => [[0, 320], [320, 320], [320 - d, 320 - d], [d, 320 - d]],
    top: (d) => [[0, 0], [320, 0], [320 - d, d], [d, d]],
    left: (d) => [[0, 0], [0, 320], [d, 320 - d], [d, d]],
    right: (d) => [[320, 0], [320, 320], [320 - d, 320 - d], [320 - d, d]],
  };
  const steps = [[1, 0.8], [0.74, 0.55], [0.5, 0.3], [0.28, 0]];
  return (
    `<rect width="320" height="320" fill="${center}"/>` +
    steps
      .map(([f, t]) =>
        Object.keys(poly)
          .map((side) => `<polygon points="${poly[side](160 * f).map((q) => q.join(",")).join(" ")}" fill="${mix(e[side], center, t)}"/>`)
          .join(""),
      )
      .join("")
  );
};
const rng = (seed) => () => {
  seed = (seed + 0x6d2b79f5) >>> 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const bloom = (x, y, r, c, cc = H.butter.mid, n = 5) =>
  g(x, y, 1, Array.from({ length: n }, (_, i) => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2;
    return `<circle cx="${(Math.cos(a) * r * 0.8).toFixed(1)}" cy="${(Math.sin(a) * r * 0.8).toFixed(1)}" r="${(r * 0.55).toFixed(1)}" fill="${c}" ${o}/>`;
  }).join("") + `<circle r="${(r * 0.45).toFixed(1)}" fill="${cc}" ${o}/>`);
const bloomPalette = [H.pink.mid, H.peach.mid, H.butter.mid, H.lilac.mid, "#ffffff", H.sky.mid];
const scatterBlooms = (seed, cols, rows, skip = () => false, r0 = 7, r1 = 11) => {
  const r = rng(seed), out = [];
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const x = (i + 0.2 + 0.6 * r()) * (320 / cols), y = (j + 0.2 + 0.6 * r()) * (320 / rows);
      const rad = r0 + r() * (r1 - r0), c = bloomPalette[Math.floor(r() * bloomPalette.length)];
      if (!skip(x, y)) out.push({ x, y, rad, c });
    }
  return out.sort((a, b) => a.y - b.y).map((b) => bloom(b.x, b.y, b.rad, b.c, b.c === H.butter.mid ? H.peach.mid : H.butter.mid)).join("");
};
const kite = (x, y, s = 1, c = H.pink.mid) =>
  g(x, y, s, `<path d="M0 26Q-10 40 0 52T0 80" ${strokeW(W.fine)}/><circle cy="44" r="3" fill="${H.butter.mid}" ${o}/><circle cy="62" r="3" fill="${H.sky.mid}" ${o}/><polygon points="0,-26 17,0 0,28 -17,0" fill="${c}" ${o} stroke-linejoin="round"/><path d="M0 -26V28M-17 0H17" ${strokeW(W.fine)}/>`);
const sparkles = (pts, c = H.butter.light) => pts.map(([x, y, r]) => star(x, y, r, c)).join("");
const upEdges = { top: H.sky.light, right: H.butter.bg, bottom: H.sky.bg, left: H.green.bg };
const upField = edgeField(upEdges, "#eef7fb");
const downEdges = { top: H.green.mid, right: H.green.mid, bottom: H.sky.dark, left: H.green.mid };
const downField = edgeField(downEdges, "#bfdcab");

const moonShape = `<path transform="translate(-215 -45)" d="M215 45a50 50 0 1 0 48 70a40 40 0 1 1-48-70Z" fill="${H.butter.light}" stroke="${ink}" stroke-width="${W.outline}"/>`;
const rainbowArcs = (cx, cy, r) =>
  ["pink", "butter", "green", "sky"].map((k, i) => `<path d="M${cx - r + i * 10} ${cy}A${r - i * 10} ${r - i * 10} 0 0 1 ${cx + r - i * 10} ${cy}" fill="none" stroke="${H[k].mid}" stroke-width="10"/>`).join("");
const sunBurst = (x, y, r) =>
  Array.from({ length: 12 }, (_, i) => {
    const a = (Math.PI * 2 * i) / 12;
    return `<path d="M${(x + Math.cos(a) * (r + 12)).toFixed(1)} ${(y + Math.sin(a) * (r + 12)).toFixed(1)}L${(x + Math.cos(a) * (r + 30)).toFixed(1)} ${(y + Math.sin(a) * (r + 30)).toFixed(1)}" ${strokeW(5, H.butter.mid)}/>`;
  }).join("") + `<circle cx="${x}" cy="${y}" r="${r + 10}" fill="${H.butter.light}" opacity=".6"/><circle cx="${x}" cy="${y}" r="${r}" fill="${H.butter.mid}" stroke="${ink}" stroke-width="${W.outline}"/>`;

const plopSmall = (() => {
  const body = `<circle cx="160" cy="170" r="38"/><ellipse cx="116" cy="186" rx="9" ry="13" transform="rotate(-30 116 186)"/><ellipse cx="204" cy="186" rx="9" ry="13" transform="rotate(30 204 186)"/>`;
  return `${shaded(body, H.pink.mid, H.pink.dark, shine(145, 150, 11, 6), [160, 170])}<ellipse cx="160" cy="134" rx="26" ry="9" fill="${H.green.mid}" stroke="${ink}" stroke-width="${W.outline}"/>${sparkleEye(148, 166)}${sparkleEye(172, 166)}${cheeks(160, 177, 22, H.pink.dark)}${oMouth(160, 172)}`;
})();

const proposals = {
  U0: { title: "U0 · current: dusk meadow (Tulia)", art: drawings.U },
  U1: { title: "U1 · Cloud meadow", art: upField + cloud(30, 90, 1.1) + cloud(180, 70, 0.8) + cloud(40, 250, 0.9) + cloud(190, 275, 1.0) + cloud(112, 172, 0.7) + cloud(240, 165, 0.6) + bird(262, 36, H.pink.mid, 1, -1) + bird(70, 40, H.peach.mid, 0.9) + plane(40, 190, 1) + balloon(284, 214, 0.45) + sparkles([[150, 36, 6], [20, 150, 5], [300, 120, 6], [160, 232, 5]]) },
  U2: { title: "U2 · Sun at the zenith", art: upField + sunBurst(160, 160, 44) + cloud(20, 70, 0.8) + cloud(226, 70, 0.7) + cloud(24, 276, 0.85) + cloud(226, 284, 0.8) + bird(268, 150, H.lilac.mid, 1, -1) + bird(46, 168, H.pink.mid, 1) + sparkles([[100, 120, 5], [220, 200, 5], [150, 44, 6], [160, 282, 6]]) },
  U3: { title: "U3 · Rainbow arch", art: upField + rainbowArcs(160, 205, 112) + cloud(24, 218, 0.95) + cloud(214, 222, 0.95) + cloud(110, 70, 0.8) + cloud(236, 60, 0.6) + bird(60, 110, H.pink.mid, 1) + bird(250, 130, H.sky.mid, 1, -1) + sparkles([[160, 104, 6], [30, 40, 5], [296, 190, 5], [150, 290, 5]]) },
  U4: { title: "U4 · Up and away", art: upField + cloud(130, 74, 0.6) + cloud(130, 280, 0.8) + cloud(240, 175, 0.5) + balloon(66, 110, 0.9) + balloon(234, 96, 0.7) + kite(250, 228, 1, H.lilac.mid) + plane(50, 250, 1.2) + plane(150, 160, 0.8) + bird(180, 30, H.pink.mid, 0.9, -1) + bird(280, 150, H.peach.mid, 0.9, -1) },
  U5: { title: "U5 · Sun and moon sky", art: upField + g(100, 4, 0.85, moonShape + "") + sparkles([[40, 40, 7], [270, 40, 6], [60, 110, 5], [250, 100, 6], [160, 30, 5], [20, 80, 4], [300, 90, 4]]) + cloud(40, 170, 0.8) + cloud(206, 156, 0.9) + sunBurst(160, 270, 26) + bird(262, 230, H.pink.mid, 0.9, -1) + bird(56, 250, H.lilac.mid, 0.9) },
  D0: { title: "D0 · current: pond (Plop)", art: drawings.D },
  D1: { title: "D1 · Wildflower meadow", art: downField + scatterBlooms(7, 6, 6) + tuft(40, 120) + tuft(280, 60) + tuft(160, 310) + tuft(290, 250) + ladybug(60, 70, 1.2) + butterfly(252, 84, H.pink.mid, H.peach.mid, 1.3) + bee(72, 252, 1.3) + snail(246, 268, 1.1) },
  D2: { title: "D2 · Tulip field with Tulia", art: (() => {
    const r = rng(11), rows = [];
    for (let j = 0; j < 5; j++) for (let i = 0; i < 7; i++) {
      const x = 22 + i * 46 + (j % 2 ? 23 : 0) + (r() - 0.5) * 8, y = 76 + j * 52;
      if (Math.hypot(x - 160, y - 150) > 84) rows.push({ x, y, c: [H.pink.mid, H.butter.mid, H.lilac.mid, H.peach.mid][Math.floor(r() * 4)] });
    }
    return downField + rows.map((t) => tulip(t.x, t.y, 0.55, t.c)).join("") + g(24, -23.7, 0.85, tulia) + butterfly(52, 44, H.sky.mid, H.lilac.light, 1.1) + bee(268, 292, 1.1);
  })() },
  D3: { title: "D3 · Pond meadow with Plop", art: downField + scatterBlooms(5, 6, 6, (x, y) => ((x - 160) / 104) ** 2 + ((y - 168) / 70) ** 2 < 1) + `<ellipse cx="160" cy="168" rx="98" ry="64" fill="${H.sky.water}" stroke="${ink}" stroke-width="${W.outline}"/><ellipse cx="160" cy="176" rx="76" ry="44" fill="${H.sky.aqua}" opacity=".6"/><ellipse cx="228" cy="198" rx="20" ry="9" fill="${H.green.mid}" ${o}/><ellipse cx="96" cy="150" rx="18" ry="8" fill="${H.green.mid}" ${o}/>` + bloom(228, 194, 7, H.pink.mid) + plopSmall + bubble(204, 140, 6) + bubble(216, 122, 9) + reeds(268, 120, 0.8) + reeds(54, 264, 0.8) + dragonfly(246, 262, 1) + dragonfly(68, 80, 1) },
  D4: { title: "D4 · Picnic", art: (() => {
    const cells = Array.from({ length: 20 }, (_, k) => {
      const i = k % 5, j = Math.floor(k / 5);
      return `<rect x="${-70 + i * 28}" y="${-56 + j * 28}" width="28" height="28" fill="${(i + j) % 2 ? H.pink.light : "#fffaf1"}"/>`;
    }).join("");
    const blanket = g(160, 172, 1, `<g transform="rotate(-10)">${cells}<rect x="-70" y="-56" width="140" height="112" fill="none" stroke="${ink}" stroke-width="${W.outline}"/><path d="M-26 -18l8-26h32l8 26Z" fill="${H.peach.mid}" ${o} stroke-linejoin="round"/><path d="M-18 -44Q0 -66 18 -44" ${strokeW(W.outline)}/><circle cx="38" cy="14" r="8" fill="${H.pink.dark}" ${o}/><circle cx="-30" cy="26" r="8" fill="${H.butter.mid}" ${o}/></g>`);
    return downField + scatterBlooms(3, 6, 6, (x, y) => Math.abs(x - 160) < 96 && Math.abs(y - 172) < 80) + blanket + snail(252, 270, 1.1) + ladybug(64, 66, 1.2) + butterfly(252, 70, H.lilac.mid, H.pink.light, 1.3) + mushroom(60, 262, 1.1);
  })() },
  D5: { title: "D5 · Stepping stones and flower beds", art: (() => {
    const stones = Array.from({ length: 9 }, (_, i) => {
      const t = i / 8, x = 14 + t * 292, y = 168 + 56 * Math.sin(t * Math.PI * 2 - 0.4);
      return `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="15" ry="10" fill="${H.peach.light}" ${o} transform="rotate(${(i * 23) % 40 - 20} ${x.toFixed(1)} ${y.toFixed(1)})"/>`;
    }).join("");
    const bed = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${H.green.mid}" stroke="${ink}" stroke-width="${W.outline}"/>` + [[0, 0, 11], [-r * 0.55, -r * 0.2, 8], [r * 0.5, -r * 0.3, 8], [-r * 0.2, r * 0.5, 8], [r * 0.45, r * 0.4, 8]].map(([dx, dy, rad], k) => bloom(x + dx, y + dy, rad, bloomPalette[(k + 2) % bloomPalette.length])).join("");
    return downField + scatterBlooms(9, 5, 5, (x, y) => Math.abs(y - (168 + 56 * Math.sin(((x - 14) / 292) * Math.PI * 2 - 0.4))) < 26 || Math.hypot(x - 78, y - 84) < 52 || Math.hypot(x - 244, y - 262) < 52, 6, 9) + stones + bed(78, 84, 40) + bed(244, 262, 40) + bee(180, 120, 1.2) + bee(130, 270, 1.1) + mushroom(280, 90, 1) + snail(50, 292, 0.9);
  })() },
};
const pdir = new URL("proposals/", dir);
mkdirSync(pdir, { recursive: true });
for (const [id, p] of Object.entries(proposals))
  writeFileSync(new URL(`${id}.svg`, pdir), `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320">${p.art}</svg>\n`);
// Review sheets (preview only, not print or app assets): each proposal attached to the continuous belt.
const nest = (markup, x, y, size) =>
  `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 320 320" overflow="hidden">${markup}<rect width="320" height="320" fill="none" stroke="${ink}" stroke-width="3"/></svg>`;
const sheet = (kind, ids) => {
  const s = 140, cell = s + 4;
  const body = ids.map((id, k) => {
    const ox = 20 + (k % 2) * 620, oy = 20 + Math.floor(k / 2) * 350;
    const beltY = kind === "U" ? oy + 34 + cell : oy + 34, faceY = kind === "U" ? oy + 34 : oy + 34 + cell;
    return `<text x="${ox}" y="${oy + 20}" font-family="system-ui, sans-serif" font-size="18" fill="${ink}">${proposals[id].title}</text>` + ["L", "F", "R", "B"].map((f, i) => nest(drawings[f], ox + i * cell, beltY, s)).join("") + nest(proposals[id].art, ox + cell, faceY, s);
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1260 1070" width="1260" height="1070"><rect width="1260" height="1070" fill="#f5f3eb"/>${body}</svg>\n`;
};
writeFileSync(new URL("up.svg", pdir), sheet("U", ["U0", "U1", "U2", "U3", "U4", "U5"]));
writeFileSync(new URL("down.svg", pdir), sheet("D", ["D0", "D1", "D2", "D3", "D4", "D5"]));
