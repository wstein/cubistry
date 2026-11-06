import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeSvg } from "../packages/cube-assets/src/index.ts";
import { isCrossAspect } from "../src/apps/playground/upload.ts";
import { netTemplateSource, netTemplateSvg, templateSize } from "../src/apps/playground/template.ts";
import { FACE_IDS } from "../src/apps/playground/themes.ts";

test("the blank net template: sizes, content and sanitizer compliance for every size", () => {
  assert.deepEqual(templateSize(2), { face: 200, width: 800, height: 600 });
  assert.deepEqual(templateSize(7), { face: 700, width: 2800, height: 2100 });
  assert.throws(() => templateSize(1), /2 to 7/);
  assert.throws(() => templateSize(8), /2 to 7/);
  for (let n = 2; n <= 7; n++) {
    const source = netTemplateSource(n);
    const { stripped } = sanitizeSvg(source);
    assert.deepEqual(stripped, [], `n=${n} needs no stripping`);
    const svg = netTemplateSvg(n);
    assert.equal(sanitizeSvg(svg).svg, svg, "canonical");
    const { width, height } = templateSize(n);
    assert.match(svg, new RegExp(`viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"`));
    for (const f of FACE_IDS) assert.match(svg, new RegExp(`>${f}</text>`));
    // grid lines: n-1 inner lines in each direction per face
    const d = [...svg.matchAll(/<path d="([^"]*)"/g)].map((m) => m[1]);
    assert.equal(d.length, 6);
    for (const path of d) assert.equal((path.match(/M/g) ?? []).length, 2 * (n - 1));
    assert.ok(isCrossAspect(width, height));
  }
});
