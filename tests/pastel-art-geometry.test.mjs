import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Pastel Garden bodies are drawn as one ink group (stroke-width 6) with a colored copy on top.
// Two disjoint shapes closer than the stroke width let their half outlines close the gap and
// leave an ink pocket inside the silhouette. Disjoint shapes must be at least 6 units apart;
// overlapping shapes merge into one body and are fine.
const BODY_STROKE = 6;
const dir = new URL("../public/playground-pastel/", import.meta.url);
const attr = (s, k) => s.match(new RegExp(`\\s${k}="([^"]+)"`))?.[1];

function outline(tag) {
  const circle = tag.startsWith("<circle");
  const cx = +(attr(tag, "cx") ?? 0), cy = +(attr(tag, "cy") ?? 0);
  const rx = +(circle ? attr(tag, "r") : attr(tag, "rx")), ry = +(circle ? attr(tag, "r") : attr(tag, "ry"));
  const rot = (+((attr(tag, "transform") ?? "").match(/rotate\(([-\d.]+)/)?.[1] ?? 0) * Math.PI) / 180;
  const points = Array.from({ length: 720 }, (_, i) => {
    const a = (i / 720) * 2 * Math.PI, u = rx * Math.cos(a), v = ry * Math.sin(a);
    return [cx + u * Math.cos(rot) - v * Math.sin(rot), cy + u * Math.sin(rot) + v * Math.cos(rot)];
  });
  const inside = ([x, y]) => {
    const dx = x - cx, dy = y - cy;
    const u = dx * Math.cos(rot) + dy * Math.sin(rot), v = -dx * Math.sin(rot) + dy * Math.cos(rot);
    return (u / rx) ** 2 + (v / ry) ** 2 <= 1;
  };
  return { tag, points, inside };
}

test("disjoint shapes inside a pastel ink body group are at least one stroke width apart", () => {
  const groupPattern = new RegExp(`<g stroke="#4a3a38" stroke-width="${BODY_STROKE}" stroke-linejoin="round" fill="#4a3a38">(.*?)</g>`, "g");
  const failures = [];
  let groups = 0, pairs = 0;
  for (const face of ["F", "B", "R", "L", "U", "D"]) {
    const svg = readFileSync(new URL(`${face}.svg`, dir), "utf8");
    for (const match of svg.matchAll(groupPattern)) {
      groups++;
      const shapes = [...match[1].matchAll(/<(?:circle|ellipse)[^>]*\/>/g)].map((m) => outline(m[0]));
      for (let i = 0; i < shapes.length; i++) for (let j = i + 1; j < shapes.length; j++) {
        const a = shapes[i], b = shapes[j];
        if (a.points.some(b.inside) || b.points.some(a.inside)) continue;
        pairs++;
        let d = Infinity;
        for (const p of a.points) for (const q of b.points) d = Math.min(d, Math.hypot(p[0] - q[0], p[1] - q[1]));
        if (d < BODY_STROKE) failures.push(`${face}: gap ${d.toFixed(2)} < ${BODY_STROKE} between ${a.tag} and ${b.tag}`);
      }
    }
  }
  assert(groups >= 6, `found only ${groups} ink body groups`);
  assert(pairs > 0, "no disjoint shape pairs were measured");
  assert.deepEqual(failures, []);
});
