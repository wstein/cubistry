import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { auditSvg, parseXml, TAGS, ATTRS } from "../src/svgcheck.mjs";

const NS = 'xmlns="http://www.w3.org/2000/svg"';
const doc = (inner, root = `${NS} width="420" height="420" viewBox="0 0 420 420"`) => `<svg ${root}>${inner}</svg>`;
const ids = (svg, opt) => auditSvg(svg, opt).map((p) => p.id);

test("the tag and attribute allowlists equal the app's validateSvg lists (guards drift)", () => {
  const ts = readFileSync(new URL("../../../../packages/cube-assets/src/index.ts", import.meta.url), "utf8");
  const list = (name) => [...new RegExp(`const ${name} = new Set\\(\\[([\\s\\S]*?)\\]\\)`).exec(ts)[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual([...TAGS].sort(), list("allowedTags").sort());
  assert.deepEqual([...ATTRS].sort(), list("allowedAttrs").sort());
  assert.match(ts, /w <= 1024/);
  assert.match(ts, /bytesPerFile|ASSET_LIMITS/);
});

test("a plain allowed file is accepted", () => {
  const ok = doc('<g opacity=".5"><rect x="0" y="0" width="5" height="5" fill="#fff"/><path d="M0 0L1 1" stroke="#000" stroke-width="2" stroke-linecap="round"/></g>');
  assert.deepEqual(auditSvg(ok), []);
  assert.deepEqual(auditSvg("\ufeff" + ok), []);
});

// Negative controls: every bypass the review found, plus the rest of the allowlist.
const bypasses = {
  "shape-rendering attribute": [doc('<g shape-rendering="crispEdges"><rect width="1" height="1"/></g>'), "attribute:shape-rendering"],
  "prefixed <s:text> (renders text)": [doc('<s:text xmlns:s="http://www.w3.org/2000/svg" x="10" y="20">Hi</s:text>'), "prefixed:s:text"],
  "prefixed xmlns declaration": [doc('<rect xmlns:s="http://www.w3.org/2000/svg" width="1" height="1"/>'), "prefixed-namespace"],
  "prefixed gradient element": [doc('<s:linearGradient xmlns:s="http://www.w3.org/2000/svg" id="g2"/>'), "prefixed:s:linearGradient"],
  "entity-encoded url( in fill": [doc('<rect width="9" height="9" fill="&#117;rl(#g2)"/>'), "url()"],
  "hex entity-encoded url(": [doc('<rect width="9" height="9" fill="&#x75;rl(#g2)"/>'), "url()"],
  "css mask-image in style": [doc('<rect width="9" height="9" style="mask-image:linear-gradient(black,transparent)"/>'), "attribute:style"],
  "-webkit-mask in style": [doc('<rect width="9" height="9" style="-webkit-mask:linear-gradient(#000,transparent)"/>'), "attribute:style"],
  "mask attribute": [doc('<rect width="9" height="9" mask="x"/>'), "mask"],
  "<animate>": [doc('<rect width="9" height="9"><animate attributeName="fill" from="red" to="blue" dur="1s"/></rect>'), "element:animate"],
  "<style> element": [doc("<style>rect{fill:red}</style>"), "style-element"],
  "<use>": [doc('<use x="1" y="1"/>'), "element:use"],
  "<defs>": [doc("<defs/>"), "element:defs"],
  "<linearGradient>": [doc('<linearGradient id="g"><stop offset="0"/></linearGradient>'), "gradient"],
  "<pattern>": [doc("<pattern/>"), "pattern"],
  "<filter> and filter attr": [doc('<filter/><rect width="1" height="1" filter="x"/>'), "filter"],
  "<clipPath> and clip-path attr": [doc('<clipPath/><rect width="1" height="1" clip-path="x"/>'), "clipPath"],
  "<text>": [doc("<text>x</text>"), "text"],
  "<image>": [doc('<image width="1" height="1"/>'), "image"],
  "href attribute": [doc('<rect width="1" height="1" href="#a"/>'), "href"],
  "xlink:href attribute": [doc('<rect width="1" height="1" xlink:href="#a"/>'), "href"],
  "event handler": [doc('<rect width="1" height="1" onload="x()"/>'), "event-handler"],
  "id and class attributes": [doc('<rect width="1" height="1" id="a" class="b"/>'), "attribute:id"],
  "url( with space": [doc('<rect fill="url (#a)" width="1" height="1"/>'), "url()"],
  "javascript: value": [doc('<rect width="1" height="1" fill="javascript:alert(1)"/>'), "unsafe-value"],
  "data: value": [doc('<rect width="1" height="1" fill="data:x"/>'), "unsafe-value"],
  "https: value": [doc('<rect width="1" height="1" fill="https://x"/>'), "unsafe-value"],
  "@ in value": [doc('<rect width="1" height="1" fill="@import"/>'), "unsafe-value"],
  "backslash in value": [doc('<rect width="1" height="1" fill="\\75rl(#a)"/>'), "unsafe-value"],
  "control character in value (via &#10;)": [doc('<path d="M0 0&#10;L1 1"/>'), "unsafe-value"],
  "DOCTYPE": [`<!DOCTYPE svg [<!ENTITY a "b">]>${doc("")}`, "declaration"],
  "comment": [doc("<!-- x -->"), "declaration"],
  "processing instruction": [`<?xml version="1.0"?>${doc("")}`, "declaration"],
  "script word": [doc('<g><script>1</script></g>'), "script"],
  "foreignObject word": [doc("<foreignObject/>"), "script"],
  "element in another namespace": [`<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><rect xmlns="http://example.com/x" width="1" height="1"/></svg>`, "namespace"],
  "no xmlns on the root": [`<svg width="1" height="1"><rect width="1" height="1"/></svg>`, "namespace"],
  "non-integer width": [doc("", `${NS} width="106.66666666666667" height="106.66666666666667"`), "dimension"],
  "width above 1024": [doc("", `${NS} width="1025" height="1025"`), "dimension"],
  "missing height": [doc("", `${NS} width="10"`), "dimension"],
  "undefined entity": [doc('<rect width="1" height="1" fill="&bogus;"/>'), "parse"],
  "unclosed element": [`<svg ${NS} width="1" height="1"><g></svg>`, "parse"],
  "two roots": [`${doc("")}${doc("")}`, "parse"],
  "unquoted attribute": [`<svg ${NS} width=1 height=1/>`, "parse"],
  "oversized file": [doc(`<path d="${"M0 0".repeat(70000)}"/>`), "size"],
};
for (const [name, [svg, id]] of Object.entries(bypasses)) {
  test(`rejected: ${name}`, () => assert.ok(ids(svg).includes(id), `${id} not in ${JSON.stringify(ids(svg))}`));
}

test("single-quoted attributes are parsed, not skipped (a quote style cannot hide a construct)", () => {
  assert.ok(ids(doc("<rect width='1' height='1' fill='url(#a)'/>")).includes("url()"));
  assert.ok(ids(doc("<rect width='1' height='1' style='mask-image:x'/>")).includes("attribute:style"));
});

test("net mode skips the dimension and size rules but keeps the allowlist", () => {
  const net = doc('<rect width="1" height="1"/>', `${NS} width="1730" height="1300" viewBox="0 0 1730 1300"`);
  assert.deepEqual(auditSvg(net, { dimensions: false, size: false }), []);
  assert.ok(ids(net).includes("dimension"));
  assert.ok(ids(doc('<rect width="1" height="1" overflow="hidden"/>'), { dimensions: false }).includes("attribute:overflow"));
});

test("parseXml: namespaces and decoded attribute values", () => {
  const root = parseXml(doc('<g><rect x="&#52;&#50;" width="1" height="1"/></g>'));
  assert.equal(root.ns, "http://www.w3.org/2000/svg");
  assert.equal(root.children[0].children[0].ns, "http://www.w3.org/2000/svg");
  assert.equal(root.children[0].children[0].attrs.find((a) => a.name === "x").value, "42");
});
