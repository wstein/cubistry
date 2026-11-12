// Measures and chooses the six tints of the Calendar7 color scheme "Rubik-Tint" (owner design 2026-11-12).
// Usage: node scripts/calendar7-rubik-tint.mjs            prints the table for the shipped tints
//        node scripts/calendar7-rubik-tint.mjs --optimize  searches the strengths (deterministic) and prints them
// Colour difference: CIEDE2000 (Sharma et al. 2005, kL = kC = kH = 1), D65, sRGB. Contrast: WCAG 2.x.
import { contrast, mix } from "../tests/calendar7-contrast.mjs";

/** Standard Rubik colors (the common sticker values; white opposite yellow, red opposite orange, blue opposite green). */
export const RUBIK = Object.freeze({ white: "#ffffff", yellow: "#ffd500", red: "#b71234", orange: "#ff5800", blue: "#0046ad", green: "#009b48" });
export const FACES = Object.freeze(Object.keys(RUBIK));
export const PRINT = "#111111";
export const BAND = "#111111";
export const BAND_INK = "#ffffff";
/** Gates: contrast of the print on every tint, of the band lettering on the band, and the least CIEDE2000 distance of any two tints (white included). */
export const MIN_PRINT_CONTRAST = 12;
export const MIN_BAND_CONTRAST = 12;
export const MIN_PAIR_DE2000 = 15;

/** The tint of a color: `t` (0..1) of the color mixed into white, rounded to #rrggbb. */
export const tintOf = (hex, t) => mix("#ffffff", hex, t);

const lin = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
export const lab = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => lin(parseInt(hex.slice(i, i + 2), 16) / 255));
  const xyz = [(0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047, 0.2126729 * r + 0.7151522 * g + 0.072175 * b, (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883];
  const f = xyz.map((v) => (v > 216 / 24389 ? Math.cbrt(v) : (24389 / 27 * v + 16) / 116));
  return [116 * f[1] - 16, 500 * (f[0] - f[1]), 200 * (f[1] - f[2])];
};

/** CIEDE2000 of two CIELAB triples [L, a, b]. */
export const deltaE2000Lab = ([L1, a1, b1], [L2, a2, b2]) => {
  const rad = Math.PI / 180, deg = 180 / Math.PI;
  const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2), Cm = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cm ** 7 / (Cm ** 7 + 25 ** 7)));
  const ap1 = (1 + G) * a1, ap2 = (1 + G) * a2, Cp1 = Math.hypot(ap1, b1), Cp2 = Math.hypot(ap2, b2);
  const hp = (b, a) => (b === 0 && a === 0 ? 0 : ((Math.atan2(b, a) * deg) + 360) % 360);
  const hp1 = hp(b1, ap1), hp2 = hp(b2, ap2);
  const dL = L2 - L1, dC = Cp2 - Cp1;
  let dh = 0;
  if (Cp1 * Cp2 !== 0) { dh = hp2 - hp1; if (dh > 180) dh -= 360; else if (dh < -180) dh += 360; }
  const dH = 2 * Math.sqrt(Cp1 * Cp2) * Math.sin(dh * rad / 2);
  const Lm = (L1 + L2) / 2, Cpm = (Cp1 + Cp2) / 2;
  let hm = hp1 + hp2;
  if (Cp1 * Cp2 === 0) hm = hp1 + hp2;
  else if (Math.abs(hp1 - hp2) <= 180) hm /= 2;
  else hm = (hp1 + hp2 + (hp1 + hp2 < 360 ? 360 : -360)) / 2;
  const T = 1 - 0.17 * Math.cos((hm - 30) * rad) + 0.24 * Math.cos(2 * hm * rad) + 0.32 * Math.cos((3 * hm + 6) * rad) - 0.2 * Math.cos((4 * hm - 63) * rad);
  const dTheta = 30 * Math.exp(-(((hm - 275) / 25) ** 2));
  const Rc = 2 * Math.sqrt(Cpm ** 7 / (Cpm ** 7 + 25 ** 7));
  const Sl = 1 + 0.015 * (Lm - 50) ** 2 / Math.sqrt(20 + (Lm - 50) ** 2), Sc = 1 + 0.045 * Cpm, Sh = 1 + 0.015 * Cpm * T;
  const Rt = -Math.sin(2 * dTheta * rad) * Rc;
  return Math.sqrt((dL / Sl) ** 2 + (dC / Sc) ** 2 + (dH / Sh) ** 2 + Rt * (dC / Sc) * (dH / Sh));
};

export const deltaE2000 = (h1, h2) => deltaE2000Lab(lab(h1), lab(h2));

/** Every figure the gates read, for tints given as { white, yellow, ... } hex values. */
export function measure(tints) {
  const printContrast = Object.fromEntries(FACES.map((f) => [f, contrast(PRINT, tints[f])]));
  const toWhite = Object.fromEntries(FACES.filter((f) => f !== "white").map((f) => [f, deltaE2000(tints.white, tints[f])]));
  const pairs = [];
  for (let i = 0; i < FACES.length; i++) for (let j = i + 1; j < FACES.length; j++) pairs.push({ a: FACES[i], b: FACES[j], de: deltaE2000(tints[FACES[i]], tints[FACES[j]]) });
  return { printContrast, bandContrast: contrast(BAND_INK, BAND), toWhite, pairs, minPrint: Math.min(...Object.values(printContrast)), minPair: Math.min(...pairs.map((p) => p.de)) };
}

/** Deterministic search: coarse grid over the strengths of the five colors (white stays white), then a one-percent coordinate ascent. */
export function optimize() {
  const colors = FACES.filter((f) => f !== "white");
  const ok = (f, t) => contrast(PRINT, tintOf(RUBIK[f], t)) >= MIN_PRINT_CONTRAST;
  const cap = Object.fromEntries(colors.map((f) => { let t = 0; while (t < 1 && ok(f, Math.min(1, t + 0.01))) t = Math.min(1, +(t + 0.01).toFixed(2)); return [f, t]; }));
  const score = (s) => measure(Object.fromEntries(FACES.map((f) => [f, f === "white" ? RUBIK.white : tintOf(RUBIK[f], s[f])]))).minPair;
  const levels = (f) => { const n = 8; return Array.from({ length: n + 1 }, (_, k) => +(cap[f] * k / n).toFixed(2)); };
  let best = null, bestScore = -1;
  const walk = (i, s) => {
    if (i === colors.length) { const v = score(s); if (v > bestScore) { bestScore = v; best = { ...s }; } return; }
    for (const t of levels(colors[i])) walk(i + 1, { ...s, [colors[i]]: t });
  };
  walk(0, {});
  for (let improved = true; improved;) {
    improved = false;
    for (const f of colors) for (const d of [-0.01, 0.01]) {
      const t = +(best[f] + d).toFixed(2);
      if (t < 0 || t > cap[f]) continue;
      const v = score({ ...best, [f]: t });
      if (v > bestScore + 1e-9) { bestScore = v; best = { ...best, [f]: t }; improved = true; }
    }
  }
  return { strengths: best, caps: cap, minPair: bestScore, tints: Object.fromEntries(FACES.map((f) => [f, f === "white" ? RUBIK.white : tintOf(RUBIK[f], best[f])])) };
}

export function table(tints) {
  const m = measure(tints), f2 = (v) => v.toFixed(2);
  const lines = ["face    tint     print  dE00 to white", ...FACES.map((f) => `${f.padEnd(7)} ${tints[f]}  ${f2(m.printContrast[f]).padStart(5)}  ${f === "white" ? "-" : f2(m.toWhite[f])}`)];
  lines.push(`band: ${BAND_INK} on ${BAND} ${f2(m.bandContrast)}:1`, "pair dE00:", ...m.pairs.map((p) => `  ${p.a}-${p.b} ${f2(p.de)}`), `min print contrast ${f2(m.minPrint)}, min pair dE00 ${f2(m.minPair)}`);
  return lines.join("\n");
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], "file://").href) {
  if (process.argv.includes("--optimize")) { const r = optimize(); console.log(JSON.stringify({ strengths: r.strengths, caps: r.caps, minPair: r.minPair, tints: r.tints }, null, 1)); console.log(table(r.tints)); }
  else {
    const { RUBIK_TINTS } = await import("../src/apps/calendar7/home-tint.ts");
    console.log(table(RUBIK_TINTS));
  }
}
