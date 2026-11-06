/** Allowlist audit of an SVG text (pure, no I/O, no DOM). It applies the SAME rules as `validateSvg` in
 * packages/cube-assets/src/index.ts (the app's asset validator), but on a small strict XML parse instead of regexes:
 *   - no `<!` or `<?` anywhere (DOCTYPE, ENTITY, comments, processing instructions), no `script` / `foreignObject` word;
 *   - well-formed XML with one root `svg`; every element in the SVG namespace and in the tag allowlist (so prefixed
 *     elements such as `<s:text>`, `<style>`, `<use>`, `<defs>`, `<animate>`, gradients, `<mask>` are rejected);
 *   - every attribute in the attribute allowlist (so `style`, `id`, `class`, `href`, `mask`, `filter`, `shape-rendering`,
 *     `overflow` are rejected) and its DECODED value free of `url(`, `javascript:`, `data:`, `http(s):`, `@`, backslashes
 *     and control characters (entity-encoded `&#117;rl(` is decoded before the test);
 *   - root width and height integers in 1..1024 (`dimensions` option; the net is not a shipped asset and skips it);
 *   - at most 262144 bytes (the app's per-file limit).
 * If the app's lists change, change TAGS / ATTRS below and the test that pins them.
 */

export const SVG_NS = "http://www.w3.org/2000/svg";
export const TAGS = new Set(["svg", "g", "path", "rect", "circle", "ellipse", "line", "polygon", "polyline"]);
export const ATTRS = new Set([
  "xmlns", "viewBox", "width", "height", "fill", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin",
  "opacity", "fill-opacity", "stroke-opacity", "d", "x", "y", "x1", "x2", "y1", "y2", "cx", "cy", "r", "rx", "ry",
  "points", "transform",
]);
export const MAX_BYTES = 262144;
export const MAX_SIDE = 1024;

const NAMED = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

/** Decodes XML character and the five predefined entity references. Throws on anything else. */
function decode(s) {
  return s.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[A-Za-z][\w.-]*);/g, (_, ref) => {
    if (ref[0] === "#") {
      const cp = ref[1] === "x" ? parseInt(ref.slice(2), 16) : parseInt(ref.slice(1), 10);
      if (!Number.isInteger(cp) || cp > 0x10ffff || cp === 0) throw new Error(`invalid character reference &${ref};`);
      return String.fromCodePoint(cp);
    }
    if (!(ref in NAMED)) throw new Error(`undefined entity &${ref};`);
    return NAMED[ref];
  });
}
const checkText = (s) => {
  if (/&(?!(?:#x[0-9a-fA-F]+|#[0-9]+|[A-Za-z][\w.-]*);)/.test(s)) throw new Error("bare & in text");
  decode(s);
};

/** Parses the XML subset an svg uses. Returns the root element {name, localName, prefix, attrs, ns, children}. Throws on malformed input. */
export function parseXml(text) {
  const NAME = /[A-Za-z_][\w.-]*(?::[A-Za-z_][\w.-]*)?/y;
  let i = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  const stack = [];
  let root = null;
  const fail = (m) => { throw new Error(`${m} at offset ${i}`); };
  while (i < text.length) {
    if (text[i] !== "<") {
      const j = text.indexOf("<", i);
      const chunk = text.slice(i, j < 0 ? text.length : j);
      if (!stack.length && chunk.trim()) fail("text outside the root element");
      checkText(chunk);
      i = j < 0 ? text.length : j;
      continue;
    }
    if (text[i + 1] === "!" || text[i + 1] === "?") fail("declaration, comment or processing instruction");
    if (text[i + 1] === "/") {
      NAME.lastIndex = i + 2;
      const m = NAME.exec(text);
      if (!m) fail("bad closing tag");
      const open = stack.pop();
      if (!open || open.name !== m[0]) fail(`mismatched closing tag </${m[0]}>`);
      i = m.index + m[0].length;
      while (/\s/.test(text[i] ?? "")) i++;
      if (text[i] !== ">") fail("bad closing tag");
      i++;
      continue;
    }
    NAME.lastIndex = i + 1;
    const nm = NAME.exec(text);
    if (!nm) fail("bad element name");
    const el = { name: nm[0], attrs: [], children: [] };
    i = nm.index + nm[0].length;
    for (;;) {
      const ws = i;
      while (/\s/.test(text[i] ?? "")) i++;
      if (text[i] === ">" || (text[i] === "/" && text[i + 1] === ">")) break;
      if (i === ws) fail("attribute needs preceding whitespace");
      NAME.lastIndex = i;
      const am = NAME.exec(text);
      if (!am || am.index !== i) fail("bad attribute name");
      i += am[0].length;
      while (/\s/.test(text[i] ?? "")) i++;
      if (text[i] !== "=") fail("attribute without value");
      i++;
      while (/\s/.test(text[i] ?? "")) i++;
      const q = text[i];
      if (q !== '"' && q !== "'") fail("attribute value must be quoted");
      const end = text.indexOf(q, i + 1);
      if (end < 0) fail("unterminated attribute value");
      const raw = text.slice(i + 1, end);
      if (raw.includes("<")) fail("'<' in attribute value");
      if (el.attrs.some((a) => a.name === am[0])) fail(`duplicate attribute ${am[0]}`);
      // XML attribute-value normalization: literal tab/newline become a space; character references stay as they are.
      el.attrs.push({ name: am[0], value: decode(raw.replace(/[\t\n\r]/g, " ")) });
      i = end + 1;
    }
    const selfClose = text[i] === "/";
    i += selfClose ? 2 : 1;
    const c = el.name.indexOf(":");
    el.prefix = c < 0 ? "" : el.name.slice(0, c);
    el.localName = c < 0 ? el.name : el.name.slice(c + 1);
    const parent = stack[stack.length - 1];
    const decl = el.attrs.find((a) => a.name === "xmlns");
    el.ns = decl ? decl.value : parent ? parent.ns : "";
    if (el.prefix) {
      const d = [...stack, el].reverse().flatMap((e) => e.attrs).find((a) => a.name === `xmlns:${el.prefix}`);
      if (!d) fail(`undeclared prefix ${el.prefix}`);
      el.ns = d.value;
    }
    if (parent) parent.children.push(el);
    else if (root) fail("more than one root element");
    else root = el;
    if (!selfClose) stack.push(el);
  }
  if (stack.length) fail("unclosed element");
  if (!root) fail("no root element");
  return root;
}

const GRADIENTS = new Set(["linearGradient", "radialGradient", "meshGradient"]);
const TEXTS = new Set(["text", "tspan", "textPath"]);
const LEGACY_ELEMENT = { pattern: "pattern", filter: "filter", clipPath: "clipPath", mask: "mask", image: "image", script: "script", foreignObject: "foreignObject", style: "style-element" };

const elementProblem = (el) => {
  const l = el.localName;
  const id = el.prefix ? `prefixed:${el.name}` : GRADIENTS.has(l) ? "gradient" : TEXTS.has(l) ? "text" : LEGACY_ELEMENT[l] ?? `element:${l}`;
  return { id, why: el.prefix ? "prefixed elements are not in the app's SVG subset" : `<${l}> is not in the app's SVG tag allowlist` };
};
const attributeProblem = (a) => {
  const n = a.name;
  const id = /^on/i.test(n) ? "event-handler" : /(^|:)href$/.test(n) ? "href" : n === "filter" ? "filter" : n === "clip-path" ? "clipPath" : n === "mask" ? "mask" : n.startsWith("xmlns:") ? "prefixed-namespace" : `attribute:${n}`;
  return { id, why: `attribute ${n} is not in the app's SVG attribute allowlist` };
};

/**
 * Audits svg text. Returns a list of problems [{id, why, where}] (empty = the app's validateSvg accepts the file).
 * `dimensions: false` skips the root width/height rule and `size: false` the byte limit (for the net, which is a preview and not a shipped asset).
 */
export function auditSvg(text, { dimensions = true, size = true } = {}) {
  const out = [];
  const add = (id, why, where = "") => out.push({ id, why, where });
  if (size && Buffer.byteLength(text) > MAX_BYTES) add("size", `file is larger than the app limit of ${MAX_BYTES} bytes`);
  if (/<!|<\?/.test(text)) add("declaration", "no DOCTYPE, ENTITY, comment or processing instruction (`<!`, `<?`)");
  if (/\b(?:script|foreignObject)\b/i.test(text)) add("script", "the words script and foreignObject are rejected anywhere in the file");
  let root;
  try { root = parseXml(text); } catch (e) { add("parse", `malformed SVG: ${e.message}`); return out; }
  if (root.localName !== "svg") add("root", "root element must be svg");
  const walk = (el) => {
    const allowedTag = TAGS.has(el.localName) && !el.prefix;
    if (!allowedTag) add(...Object.values(elementProblem(el)), `<${el.name}>`);
    else if (el.ns !== SVG_NS) add("namespace", `<${el.name}> is not in the SVG namespace (needs xmlns="${SVG_NS}")`, `<${el.name}>`);
    for (const a of el.attrs) {
      const okName = ATTRS.has(a.name);
      const okValue = !/[\\\x00-\x1f\x7f]/.test(a.value) && !/(?:url\s*\(|javascript:|data:|https?:|@)/i.test(a.value);
      if (a.name === "xmlns" && a.value === SVG_NS) continue;
      if (!okName) add(...Object.values(attributeProblem(a)), `<${el.name} ${a.name}>`);
      else if (!okValue) add(/url\s*\(/i.test(a.value) ? "url()" : "unsafe-value", `attribute ${a.name} has an unsafe value (url(, javascript:, data:, http(s):, @, backslash or control character after decoding)`, `<${el.name} ${a.name}>`);
    }
    el.children.forEach(walk);
  };
  walk(root);
  if (dimensions) {
    const num = (n) => { const v = root.attrs.find((a) => a.name === n)?.value; return v === undefined || v.trim() === "" ? NaN : Number(v); };
    const w = num("width"), h = num("height");
    if (!(Number.isInteger(w) && Number.isInteger(h) && w > 0 && h > 0 && w <= MAX_SIDE && h <= MAX_SIDE)) {
      add("dimension", `root width and height must be integers from 1 to ${MAX_SIDE}, got ${root.attrs.find((a) => a.name === "width")?.value}x${root.attrs.find((a) => a.name === "height")?.value}`);
    }
  }
  return out;
}
