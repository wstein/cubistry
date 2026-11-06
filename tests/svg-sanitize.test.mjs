import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeSvg, isSanitizedSvg, SvgRejected, SVG_LIMITS } from "../packages/cube-assets/src/index.ts";

const wrap = (inner, attrs = 'viewBox="0 0 100 100"') =>
  `<svg xmlns="http://www.w3.org/2000/svg" ${attrs}>${inner}</svg>`;
const rejects = (text, label) =>
  assert.throws(() => sanitizeSvg(text), SvgRejected, label ?? text.slice(0, 80));

test("a plain drawing passes and the output is canonical (idempotent)", () => {
  const { svg, stripped, viewBox } = sanitizeSvg(
    wrap(
      '<defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#f00"/><stop offset="1" stop-color="rgb(0,0,255)"/></linearGradient></defs>' +
        '<g transform="translate(1 2)"><rect x="1" y="2" width="30" height="40" fill="url(#g)" stroke="#000" stroke-width="2"/>' +
        '<path d="M0 0L10 10Z" fill="none" style="opacity:0.5;fill:red"/><text x="5" y="9" font-family="sans-serif" font-size="8">Hi &amp; bye</text></g>',
    ),
  );
  assert.deepEqual(stripped, []);
  assert.deepEqual([...viewBox], [0, 0, 100, 100]);
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 100 100" width="100" height="100"/);
  assert.match(svg, /Hi &amp; bye/);
  assert.equal(sanitizeSvg(svg).svg, svg);
  assert.ok(isSanitizedSvg(svg));
  assert.ok(!isSanitizedSvg(wrap("<script>1</script>")));
});

test("the XML declaration and comments are dropped; size comes from width and height without a viewBox", () => {
  const { svg, viewBox } = sanitizeSvg('<?xml version="1.0"?><!-- hi --><svg xmlns="http://www.w3.org/2000/svg" width="64px" height="32"><rect width="1" height="1"/></svg>');
  assert.deepEqual([...viewBox], [0, 0, 64, 32]);
  assert.ok(!svg.includes("hi") && !svg.includes("<?"));
});

test("options override the viewBox (net cutting) and the pixel size", () => {
  const out = sanitizeSvg(wrap("<rect width='400' height='300'/>", 'viewBox="0 0 400 300"'), { viewBox: [100, 0, 100, 100], size: [1024, 1024] });
  assert.match(out.svg, /viewBox="100 0 100 100" width="1024" height="1024"/);
  assert.deepEqual([...out.viewBox], [100, 0, 100, 100]);
});

test("active and external-content elements reject the whole file, wherever they are", () => {
  const bad = [
    "<script>alert(1)</script>",
    '<script href="https://evil.example/x.js"/>',
    "<SCRIPT>alert(1)</SCRIPT>",
    '<foreignObject width="10" height="10"><iframe src="https://evil.example"/></foreignObject>',
    '<iframe src="https://evil.example"/>',
    '<object data="https://evil.example/x.svg"/>',
    '<embed src="https://evil.example/x.svg"/>',
    '<image href="https://evil.example/x.png" width="10" height="10"/>',
    '<image href="data:image/png;base64,AAAA" width="10" height="10"/>',
    '<image xlink:href="data:image/svg+xml;base64,AAAA"/>',
    '<use href="https://evil.example/x.svg#a"/>',
    '<use xlink:href="#a"/>',
    '<a href="javascript:alert(1)"><rect width="1" height="1"/></a>',
    '<animate attributeName="href" values="javascript:alert(1)"/>',
    '<set attributeName="onload" to="alert(1)"/>',
    // hidden inside an element that would be stripped anyway
    "<metadata><script>alert(1)</script></metadata>",
    "<style><script>alert(1)</script></style>",
    '<title><foreignObject><iframe/></foreignObject></title>',
    '<sodipodi:namedview><script>x</script></sodipodi:namedview>',
    "<svg:script>alert(1)</svg:script>",
  ];
  for (const inner of bad) rejects(wrap(inner), inner);
});

test("entity and DOCTYPE tricks are rejected", () => {
  rejects('<!DOCTYPE svg [<!ENTITY a "aaaaaaaaaa"><!ENTITY b "&a;&a;&a;&a;&a;&a;&a;&a;">]><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><text>&b;</text></svg>', "billion laughs");
  rejects('<!DOCTYPE svg SYSTEM "http://evil.example/x.dtd"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"/>', "external DTD");
  rejects('<?xml version="1.0"?><!DOCTYPE svg [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><text>&xxe;</text></svg>', "xxe");
  rejects(wrap("<text>&nbsp;</text>"), "unknown named entity");
  rejects(wrap("<text>&#x1;</text>"), "control character reference");
  rejects(wrap("<text>a & b</text>"), "bare ampersand");
  rejects('<?xml-stylesheet href="https://evil.example/x.css"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"/>', "stylesheet PI");
  rejects('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><?php echo 1 ?></svg>', "other PI");
  // numeric references decode first, so an encoded scheme is still seen
  rejects(wrap('<rect width="1" height="1" fill="&#x75;rl(http://evil.example/x)"/>'), "encoded url(");
  rejects(wrap('<linearGradient href="&#106;avascript:alert(1)"/>'), "encoded javascript:");
});

test("url() that is not a same-document fragment, @import, javascript: and CSS escapes are rejected", () => {
  for (const inner of [
    '<rect width="1" height="1" fill="url(https://evil.example/x.svg#a)"/>',
    '<rect width="1" height="1" fill="url(//evil.example/x)"/>',
    '<rect width="1" height="1" fill="url(data:image/svg+xml;base64,AAAA)"/>',
    '<rect width="1" height="1" fill="url( \'http://evil.example\' )"/>',
    '<rect width="1" height="1" clip-path="url(http://evil.example/x#c)"/>',
    '<rect width="1" height="1" style="fill:url(http://evil.example/x)"/>',
    '<rect width="1" height="1" style="background:url(\'javascript:alert(1)\')"/>',
    '<rect width="1" height="1" style="fill:red;@import url(x)"/>',
    '<rect width="1" height="1" style="fill:\\72ed"/>',
    '<rect width="1" height="1" fill="javascript:alert(1)"/>',
    '<rect width="1" height="1" stroke="expression(alert(1))"/>',
    '<path d="M0 0 L1 1 data:text/html,x"/>',
    '<rect width="1" height="1" transform="javascript:alert(1)"/>',
  ])
    rejects(wrap(inner), inner);
});

test("harmless leftovers are stripped, not fatal, and reported", () => {
  const { svg, stripped } = sanitizeSvg(
    wrap(
      '<rect width="10" height="10" onclick="alert(1)" onload="x()" onmouseover="y()" fill="red" inkscape:label="a" data-x="1" class="c"/>' +
        '<style>@import url("https://evil.example/x.css"); rect{fill:url(https://evil.example/a)}</style>' +
        '<title>t</title><desc>d</desc><metadata>m</metadata><filter id="f"><feGaussianBlur stdDeviation="2"/></filter>' +
        '<linearGradient id="g" xlink:href="https://evil.example/g.svg#g"/><linearGradient id="h" href="#g"/>' +
        '<rect width="1" height="1" href="https://evil.example"/>' +
        '<g style="fill:red;behavior:foo;position:fixed"><rect width="2" height="2"/></g>',
      'viewBox="0 0 100 100" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" onload="alert(1)"',
    ),
  );
  assert.ok(!/onclick|onload|onmouseover|evil|@import|inkscape|data-x|class=|<style|<filter|<title|<metadata|behavior|position/.test(svg), svg);
  assert.match(svg, /<linearGradient id="h" href="#g"\/>/);
  assert.match(svg, /fill="red"/);
  assert.match(svg, /style="fill:red"/);
  assert.ok(stripped.some((s) => /event handler onclick/.test(s)));
  assert.ok(stripped.some((s) => /element <style>/.test(s)));
  assert.ok(stripped.some((s) => /reference/.test(s)));
  assert.equal(sanitizeSvg(svg).svg, svg);
});

test("prototype-polluting attribute names are not trusted", () => {
  const { svg } = sanitizeSvg(wrap('<rect width="1" height="1" constructor="x" __proto__="y" toString="z"/>'));
  assert.ok(!/constructor|__proto__|toString/.test(svg), svg);
});

test("malformed or oversized input is rejected", () => {
  rejects("", "empty");
  rejects("not xml at all");
  rejects(wrap("<rect width='1'"), "truncated tag");
  rejects(wrap("<g><rect width='1' height='1'/>"), "unclosed element");
  rejects(wrap("<g></rect></g>"), "mismatched end tag");
  rejects(wrap("<rect width=1 height=1/>"), "unquoted attribute");
  rejects(wrap('<rect width="1" width="2"/>'), "duplicate attribute");
  rejects(wrap("<rect/>") + wrap("<rect/>"), "two roots");
  rejects("<html xmlns='http://www.w3.org/1999/xhtml'><body/></html>", "wrong root");
  rejects('<svg xmlns="http://www.w3.org/1999/xhtml" viewBox="0 0 1 1"/>', "wrong namespace");
  rejects('<svg xmlns="http://www.w3.org/2000/svg"/>', "no size");
  rejects(wrap("", 'viewBox="0 0 0 10"'), "zero viewBox");
  rejects(wrap("", 'viewBox="0 0 NaN 10"'), "nan viewBox");
  rejects(wrap("<path d=\"M0 0 <script>\"/>"), "markup in attribute");
  rejects(wrap("\u0000"), "control character");
  rejects(wrap("<g>".repeat(SVG_LIMITS.depth + 2) + "</g>".repeat(SVG_LIMITS.depth + 2)), "too deep");
  rejects(wrap("<g/>".repeat(SVG_LIMITS.elements + 1)), "too many elements");
  rejects(wrap(`<path d="M0 0${" L1 1".repeat(SVG_LIMITS.bytes / 4)}"/>`), "over the byte limit");
});

test("nested svg and unknown elements are stripped with their children", () => {
  const { svg, stripped } = sanitizeSvg(wrap('<svg><rect width="1" height="1"/></svg><switch><rect width="2" height="2"/></switch><pattern id="p"><rect width="3" height="3"/></pattern><rect width="4" height="4"/>'));
  assert.equal((svg.match(/<rect/g) ?? []).length, 1);
  assert.ok(stripped.includes("element <switch>"));
});

// Regression: patterns that backtrack must not let a small file stall the page. Each case used to take
// seconds to minutes; all must now finish in a few milliseconds, whatever the outcome.
test("pathological attribute values are handled in bounded time", () => {
  const cases = {
    "transform, exponential spaces": wrap(`<g transform="scale(1)${" ".repeat(60)}!"/>`),
    "transform, repeated calls": wrap(`<g transform="${"scale(1) ".repeat(30)}!"/>`),
    "length, long digits": wrap(`<rect x="${"1".repeat(200000)}x" width="1" height="1"/>`),
    "number, long digits": wrap(`<rect opacity="${"1".repeat(200000)}x" width="1" height="1"/>`),
    "color, rgb with spaces": wrap(`<rect fill="rgb(${" ".repeat(200000)}x" width="1" height="1"/>`),
    "root width, long digits": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1" width="${"1".repeat(200000)}x"/>`,
    "style, spaces": wrap(`<rect style="fill:${" ".repeat(900)}!" width="1" height="1"/>`),
    "viewBox, long": wrap("", `viewBox="${"1 ".repeat(100000)}"`),
  };
  for (const [name, text] of Object.entries(cases)) {
    const start = performance.now();
    try { sanitizeSvg(text); } catch (e) { assert.ok(e instanceof SvgRejected, name); }
    const ms = performance.now() - start;
    assert.ok(ms < 250, `${name} took ${ms.toFixed(0)} ms`);
  }
  // Long simple values are stripped (or, for geometry, refused), never matched.
  const { stripped } = sanitizeSvg(wrap(`<rect x="${"1".repeat(65)}" width="1" height="1"/>`));
  assert.ok(stripped.some((x) => /too long/.test(x)));
  rejects(wrap(`<g transform="${"scale(1) ".repeat(40)}"/>`), "transform over its cap");
});

test("preserveAspectRatio is written once, canonical, and can be forced", () => {
  const a = sanitizeSvg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 11" preserveAspectRatio="xMidYMid slice"><rect width="1" height="1"/></svg>').svg;
  assert.equal((a.match(/preserveAspectRatio/g) ?? []).length, 1);
  assert.equal(sanitizeSvg(a).svg, a);
  const none = sanitizeSvg(a, { preserveAspectRatio: "none", size: [64, 64] }).svg;
  assert.match(none, /width="64" height="64" preserveAspectRatio="none"/);
  assert.equal(sanitizeSvg(none).svg, none);
});
