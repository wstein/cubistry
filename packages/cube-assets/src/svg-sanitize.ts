// Allowlist sanitizer for untrusted SVG (user uploads). It never uses the DOM: the text is tokenized
// by a small strict XML reader, every element and attribute is checked against an allowlist and the
// accepted subset is serialized again from scratch. The output is therefore independent of how a
// browser would have parsed the input. The sanitized text is meant to be shown only through an
// <img> (blob URL), never inlined into the page; the sanitizer is the second line of defense.
//
// Rejected (the whole file is refused): DOCTYPE/ENTITY declarations and unknown entity references,
// processing instructions other than the XML declaration, <script>, <foreignObject>, <iframe>,
// <object>, <embed>, <image>, <use>, <a>, animation elements and other active or external-content
// elements anywhere in the tree (even inside an element that would be stripped), url() that is not
// a same-document fragment, javascript:/data:/vbscript: values, @import, CSS escapes, malformed
// markup, and oversized or too deeply nested input.
// Stripped (reported, the rest is kept): event-handler attributes, href values that are not
// same-document fragments or not on a gradient, unknown attributes, namespaced attributes and
// elements (editor metadata), <style>, <title>, <desc>, <metadata>, filters, patterns and other
// non-allowlisted elements with their children, comments and the XML declaration.
import { demand } from "@cubistry/cube-core";

export const SVG_LIMITS = Object.freeze({
  bytes: 5 * 1024 * 1024,
  elements: 20000,
  depth: 48,
  attributeChars: 262144,
  textChars: 1000,
});

export class SvgRejected extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "SvgRejected";
  }
}

export interface SanitizeOptions {
  /** Replace the root viewBox (used to cut one face out of a net). */
  readonly viewBox?: readonly [number, number, number, number];
  /** Root preserveAspectRatio to write; "none" stretches the viewBox to the size. Default: the source's. */
  readonly preserveAspectRatio?: string;
  /** Set the root width/height (the intrinsic pixel size of the decoded image). */
  readonly size?: readonly [number, number];
}

export interface SanitizedSvg {
  readonly svg: string;
  /** The viewBox that applies to `svg` (the original one, or the width/height box when none). */
  readonly viewBox: readonly [number, number, number, number];
  /** Human-readable notes about what was removed. */
  readonly stripped: readonly string[];
}

const NS = "http://www.w3.org/2000/svg";
const ALLOWED_ELEMENTS = new Set([
  "svg", "g", "defs", "path", "rect", "circle", "ellipse", "line", "polygon", "polyline",
  "text", "tspan", "linearGradient", "radialGradient", "stop", "clipPath",
]);
// Lower case. Active content, external content or links: a file with one of these is refused.
const REJECTED_ELEMENTS = new Set([
  "script", "foreignobject", "iframe", "frame", "frameset", "object", "embed", "applet", "image",
  "use", "a", "animate", "animatemotion", "animatetransform", "animatecolor", "set", "audio",
  "video", "canvas", "handler", "listener", "link", "meta", "base", "html", "body", "bgsound",
]);
const FRAGMENT = /^#[A-Za-z_][\w.-]{0,63}$/;
const URL_FRAGMENT = /^url\(\s*#[A-Za-z_][\w.-]{0,63}\s*\)$/;
// Every pattern below is anchored and has no nested or adjacent quantifiers that can match the same
// characters in more than one way, so matching takes time linear in the (capped) value length.
const NUMBER = "[-+]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:[eE][-+]?\\d+)?";
const LENGTH = new RegExp(`^${NUMBER}(?:px|%|pt|em|mm|cm|in)?$`);
const NUMBER_ONLY = new RegExp(`^${NUMBER}$`);
const NUMBER_LIST = /^[-+\d.eE\s,]{0,262144}$/;
const PATH_DATA = /^[MmLlHhVvCcSsQqTtAaZz\d.eE+\-,\s]{0,262144}$/;
const TRANSFORM = /^\s*(?:(?:matrix|translate|scale|rotate|skewX|skewY)\s*\([-+\d.eE\s,]*\)[\s,]*)*$/;
const COLOR =
  /^(?:none|currentColor|inherit|transparent|[A-Za-z]{3,24}|#[0-9a-fA-F]{3,8}|(?:rgb|rgba|hsl|hsla)\([\d.\s,%]+\))$/;
const NAME_LIST = /^[A-Za-z0-9 ,'_-]{0,200}$/;
const KEYWORD = /^[A-Za-z0-9-]{1,32}$/;

type Check = (value: string) => boolean;
const length: Check = (v) => LENGTH.test(v);
const color: Check = (v) => COLOR.test(v) || URL_FRAGMENT.test(v);
const keyword: Check = (v) => KEYWORD.test(v);
const number: Check = (v) => NUMBER_ONLY.test(v);
const offset: Check = (v) => LENGTH.test(v);
// Attribute name -> value check. Everything else is stripped.
const ATTRIBUTE_CHECKS: Readonly<Record<string, Check>> = {
  id: (v) => /^[A-Za-z_][\w.-]{0,63}$/.test(v),
  viewBox: (v) => NUMBER_LIST.test(v),
  preserveAspectRatio: (v) => /^[A-Za-z\s]{0,40}$/.test(v),
  width: length, height: length, x: length, y: length, x1: length, x2: length, y1: length,
  y2: length, cx: length, cy: length, r: length, rx: length, ry: length, fx: length, fy: length,
  dx: length, dy: length,
  d: (v) => PATH_DATA.test(v),
  points: (v) => NUMBER_LIST.test(v),
  transform: (v) => TRANSFORM.test(v),
  gradientTransform: (v) => TRANSFORM.test(v),
  gradientUnits: keyword, spreadMethod: keyword, offset,
  fill: color, stroke: color, "stop-color": color,
  "fill-opacity": number, "stroke-opacity": number, opacity: number, "stop-opacity": number,
  "stroke-width": length, "stroke-miterlimit": number, "stroke-dashoffset": length,
  "stroke-dasharray": (v) => /^(?:none|[\d.\s,%]+)$/.test(v),
  "stroke-linecap": keyword, "stroke-linejoin": keyword, "fill-rule": keyword, "clip-rule": keyword,
  display: keyword, visibility: keyword,
  "clip-path": (v) => v === "none" || URL_FRAGMENT.test(v),
  "font-family": (v) => NAME_LIST.test(v), "font-size": length, "font-weight": keyword,
  "font-style": keyword, "text-anchor": keyword, "dominant-baseline": keyword,
  "letter-spacing": length, "text-decoration": keyword,
};
const ATTRIBUTES: ReadonlyMap<string, Check> = new Map(Object.entries(ATTRIBUTE_CHECKS));
const MAX_SIMPLE_VALUE = 64;
const ATTRIBUTE_CAPS: ReadonlyMap<string, number> = new Map([
  ["d", SVG_LIMITS.attributeChars], ["points", SVG_LIMITS.attributeChars], ["viewBox", 200],
  ["transform", 256], ["gradientTransform", 256], ["font-family", 200], ["stroke-dasharray", 256],
  ["clip-path", 100],
]);
const STRICT_ATTRIBUTES = /^(?:d|points|transform|viewBox|width|height)$/;
const STYLE_PROPERTIES = new Set([
  "fill", "stroke", "stroke-width", "opacity", "fill-opacity", "stroke-opacity", "stop-color",
  "stop-opacity", "stroke-linecap", "stroke-linejoin", "fill-rule", "display", "visibility",
  "font-family", "font-size", "font-weight", "font-style", "text-anchor", "dominant-baseline",
]);

interface XmlElement {
  readonly name: string;
  readonly attrs: Map<string, string>;
  readonly children: (XmlElement | string)[];
}

function reject(reason: string): never {
  throw new SvgRejected(reason);
}

/** Decodes the five predefined entities and numeric references; anything else is refused. */
function decodeEntities(raw: string): string {
  if (!raw.includes("&")) return raw;
  return raw.replace(/&(?:#x([0-9A-Fa-f]{1,6})|#(\d{1,7})|([A-Za-z]+));|&/g, (m, hex, dec, name) => {
    if (m === "&") return reject("Malformed entity reference");
    if (name !== undefined) {
      const known: Record<string, string> = { lt: "<", gt: ">", amp: "&", quot: '"', apos: "'" };
      return known[name] ?? reject(`Entity reference &${name}; is not allowed`);
    }
    const cp = hex !== undefined ? parseInt(hex, 16) : parseInt(dec, 10);
    if (!(cp === 9 || cp === 10 || cp === 13 || (cp >= 32 && cp <= 0x10ffff && !(cp >= 0xd800 && cp <= 0xdfff) && cp !== 0x7f)))
      reject("Control character reference is not allowed");
    return String.fromCodePoint(cp);
  });
}

function escapeText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function escapeAttr(s: string): string {
  return escapeText(s).replace(/"/g, "&quot;");
}

/** Strict tokenizer: builds a tree, refusing anything outside the plain-XML subset used by SVG. */
function parse(text: string): XmlElement {
  const root: XmlElement = { name: "#document", attrs: new Map(), children: [] };
  const stack: XmlElement[] = [root];
  let i = 0,
    elements = 0,
    sawRoot = false;
  if (text.charCodeAt(0) === 0xfeff) i = 1;
  const nameAt = /[A-Za-z_][\w.-]*(?::[A-Za-z_][\w.-]*)?/y;
  const readName = (): string => {
    nameAt.lastIndex = i;
    const m = nameAt.exec(text);
    if (!m) reject("Malformed markup");
    i += m[0].length;
    return m[0];
  };
  const space = () => {
    while (i < text.length && " \t\r\n".includes(text[i])) i++;
  };
  while (i < text.length) {
    const lt = text.indexOf("<", i);
    const chunk = text.slice(i, lt < 0 ? text.length : lt);
    if (chunk) {
      const top = stack[stack.length - 1];
      if (top === root) {
        if (chunk.trim()) reject("Text outside the root element");
      } else top.children.push(decodeEntities(chunk));
    }
    if (lt < 0) break;
    i = lt;
    if (text.startsWith("<!--", i)) {
      const end = text.indexOf("-->", i + 4);
      if (end < 0) reject("Unterminated comment");
      i = end + 3;
    } else if (text.startsWith("<![CDATA[", i)) {
      const end = text.indexOf("]]>", i);
      if (end < 0) reject("Unterminated CDATA section");
      const top = stack[stack.length - 1];
      if (top === root) reject("CDATA outside the root element");
      top.children.push(text.slice(i + 9, end));
      i = end + 3;
    } else if (text.startsWith("<!", i)) {
      reject("DOCTYPE and entity declarations are not allowed");
    } else if (text.startsWith("<?", i)) {
      const end = text.indexOf("?>", i);
      if (end < 0) reject("Unterminated processing instruction");
      if (!(i === (text.charCodeAt(0) === 0xfeff ? 1 : 0) && /^<\?xml[\s?]/.test(text.slice(i, i + 6)) && !/^<\?xml-/.test(text.slice(i, i + 10))))
        reject("Processing instructions are not allowed");
      i = end + 2;
    } else if (text.startsWith("</", i)) {
      i += 2;
      const name = readName();
      space();
      if (text[i] !== ">") reject("Malformed end tag");
      i++;
      const top = stack.pop()!;
      if (top === root || top.name !== name) reject("Mismatched end tag");
    } else {
      i++;
      const name = readName();
      if (REJECTED_ELEMENTS.has(name.toLowerCase().replace(/^[^:]*:/, "")))
        reject(`<${name}> is not allowed`);
      if (++elements > SVG_LIMITS.elements) reject("Too many elements");
      const attrs = new Map<string, string>();
      let selfClosing = false;
      for (;;) {
        const before = i;
        space();
        if (text[i] === ">") {
          i++;
          break;
        }
        if (text.startsWith("/>", i)) {
          i += 2;
          selfClosing = true;
          break;
        }
        if (i === before) reject("Malformed start tag");
        const attr = readName();
        space();
        if (text[i] !== "=") reject("Attribute without a value");
        i++;
        space();
        const quote = text[i];
        if (quote !== '"' && quote !== "'") reject("Unquoted attribute value");
        const end = text.indexOf(quote, i + 1);
        if (end < 0) reject("Unterminated attribute value");
        const raw = text.slice(i + 1, end);
        if (raw.includes("<")) reject("Malformed attribute value");
        if (raw.length > SVG_LIMITS.attributeChars) reject("Attribute value too long");
        if (attrs.has(attr)) reject(`Duplicate attribute ${attr}`);
        attrs.set(attr, decodeEntities(raw));
        i = end + 1;
      }
      const element: XmlElement = { name, attrs, children: [] };
      const top = stack[stack.length - 1];
      if (top === root) {
        if (sawRoot) reject("More than one root element");
        sawRoot = true;
      }
      top.children.push(element);
      if (!selfClosing) {
        stack.push(element);
        if (stack.length > SVG_LIMITS.depth + 1) reject("Elements are nested too deeply");
      }
    }
  }
  if (stack.length !== 1) reject("Unclosed element");
  if (!sawRoot) reject("No root element");
  return root.children.find((c): c is XmlElement => typeof c !== "string")!;
}

const BAD_VALUE = /javascript:|vbscript:|data:|@import|expression\s*\(|\\|\bhttps?:|\bfile:|&#|<!/i;

/** Returns the declarations of a style attribute that are on the allowlist, or rejects. */
function sanitizeStyle(value: string, stripped: string[]): string {
  const kept: string[] = [];
  if (value.length > 1024) reject("Style attribute too long");
  if (BAD_VALUE.test(value)) reject("Unsafe value in a style attribute");
  for (const declaration of value.split(";")) {
    if (!declaration.trim()) continue;
    const at = declaration.indexOf(":");
    if (at < 0) {
      stripped.push("malformed style declaration");
      continue;
    }
    const property = declaration.slice(0, at).trim().toLowerCase(),
      v = declaration.slice(at + 1).trim();
    if (BAD_VALUE.test(v) || (/url\s*\(/i.test(v) && !URL_FRAGMENT.test(v)))
      reject("Unsafe value in a style attribute");
    const check = ATTRIBUTES.get(property);
    if (STYLE_PROPERTIES.has(property) && check && check(v)) kept.push(`${property}:${v}`);
    else stripped.push(`style property ${property}`);
  }
  return kept.join(";");
}

const numbers = (v: string) => v.trim().split(/[\s,]+/).filter(Boolean).map(Number);

function pixelLength(v: string | undefined): number | null {
  if (v === undefined || v.length > 64) return null;
  const t = v.trim().replace(/px$/, "");
  return NUMBER_ONLY.test(t) ? Number(t) : null;
}

function serialize(el: XmlElement, out: string[], stripped: string[], ctx: { depth: number }): void {
  const attrs: [string, string][] = [];
  const isGradient = el.name === "linearGradient" || el.name === "radialGradient";
  for (const [name, value] of el.attrs) {
    if (name === "xmlns") {
      if (value !== NS) reject("Unsupported default namespace");
      continue;
    }
    if (/^xmlns:/.test(name) || name.includes(":") && name !== "xlink:href") {
      stripped.push(`attribute ${name}`);
      continue;
    }
    if (/^on/i.test(name)) {
      stripped.push(`event handler ${name}`);
      continue;
    }
    if (value.length > SVG_LIMITS.attributeChars) reject("Attribute value too long");
    if (name === "href" || name === "xlink:href") {
      if (/^\s*(?:javascript|vbscript|data):/i.test(value)) reject("Script or data reference in href");
      if (isGradient && FRAGMENT.test(value)) attrs.push(["href", value]);
      else stripped.push(`reference ${name}`);
      continue;
    }
    if (name === "style") {
      const css = sanitizeStyle(value, stripped);
      if (css) attrs.push(["style", css]);
      continue;
    }
    const check = ATTRIBUTES.get(name);
    // Numbers, lengths and colors are short; long values are refused before any pattern runs.
    if (value.length > (ATTRIBUTE_CAPS.get(name) ?? MAX_SIMPLE_VALUE)) {
      if (STRICT_ATTRIBUTES.test(name)) reject(`Invalid ${name} value`);
      stripped.push(`attribute ${name} (too long)`);
      continue;
    }
    if (BAD_VALUE.test(value) || (/url\s*\(/i.test(value) && !URL_FRAGMENT.test(value.trim())))
      reject(`Unsafe value in attribute ${name}`);
    if (!check) {
      stripped.push(`attribute ${name}`);
      continue;
    }
    // Presentation attributes of the allowlist must have an exact, simple shape.
    if (!check(value.trim())) {
      if (STRICT_ATTRIBUTES.test(name)) reject(`Invalid ${name} value`);
      stripped.push(`attribute ${name} (unsupported value)`);
      continue;
    }
    attrs.push([name, value.trim()]);
  }
  out.push(`<${el.name}`);
  for (const [n, v] of attrs) out.push(` ${n}="${escapeAttr(v)}"`);
  const content: string[] = [];
  const textual = el.name === "text" || el.name === "tspan";
  for (const child of el.children) {
    if (typeof child === "string") {
      if (textual) {
        const t = child.replace(/\s+/g, " ");
        if (t.length > SVG_LIMITS.textChars) reject("Text is too long");
        if (t.trim() || t === " ") content.push(escapeText(t));
      }
      continue;
    }
    if (REJECTED_ELEMENTS.has(child.name.toLowerCase())) reject(`<${child.name}> is not allowed`);
    if (child.name.includes(":") || !ALLOWED_ELEMENTS.has(child.name) || child.name === "svg") {
      stripped.push(`element <${child.name}>`);
      continue;
    }
    serialize(child, content, stripped, ctx);
  }
  if (content.length) out.push(">", ...content, `</${el.name}>`);
  else out.push("/>");
}

/** Walks a subtree that is dropped, only to refuse hidden active content and bad references. */
function auditDropped(el: XmlElement): void {
  for (const [name, value] of el.attrs) {
    if (/^\s*(?:javascript|vbscript):/i.test(value)) reject(`Script reference in ${name}`);
  }
  for (const c of el.children) {
    if (typeof c === "string") continue;
    if (REJECTED_ELEMENTS.has(c.name.toLowerCase().replace(/^[^:]*:/, ""))) reject(`<${c.name}> is not allowed`);
    auditDropped(c);
  }
}

export function sanitizeSvg(text: string, options: SanitizeOptions = {}): SanitizedSvg {
  if (typeof text !== "string") reject("SVG must be text");
  if (new TextEncoder().encode(text).length > SVG_LIMITS.bytes) reject("SVG file is too large");
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(text)) reject("Control characters are not allowed");
  const root = parse(text);
  if (root.name !== "svg") reject("The root element must be <svg>");
  const xmlns = root.attrs.get("xmlns");
  if (xmlns !== undefined && xmlns !== NS) reject("Unsupported default namespace");
  const stripped: string[] = [];
  // Dropped subtrees (unknown elements, editor metadata) are still audited.
  const audit = (el: XmlElement) => {
    for (const c of el.children) {
      if (typeof c === "string") continue;
      if (c.name.includes(":") || !ALLOWED_ELEMENTS.has(c.name) || c.name === "svg") auditDropped(c);
      else audit(c);
    }
  };
  audit(root);
  // Resolve the viewport before serializing.
  const vbRaw = root.attrs.get("viewBox");
  const w = pixelLength(root.attrs.get("width")),
    h = pixelLength(root.attrs.get("height"));
  let viewBox: [number, number, number, number];
  if (vbRaw !== undefined) {
    if (vbRaw.length > 200) reject("Invalid viewBox");
    const v = numbers(vbRaw);
    if (v.length !== 4 || v.some((n) => !Number.isFinite(n)) || v[2] <= 0 || v[3] <= 0) reject("Invalid viewBox");
    viewBox = [v[0], v[1], v[2], v[3]];
  } else if (w !== null && h !== null && w > 0 && h > 0) viewBox = [0, 0, w, h];
  else reject("The SVG needs a viewBox or a pixel width and height");
  if (viewBox.some((n) => Math.abs(n) > 1e7)) reject("viewBox is out of range");
  const outBox = options.viewBox ?? viewBox;
  if (outBox.length !== 4 || outBox.some((n) => !Number.isFinite(n)) || outBox[2] <= 0 || outBox[3] <= 0)
    reject("Invalid viewBox");
  const size = options.size ?? [w ?? outBox[2], h ?? outBox[3]];
  if (!(size[0] > 0 && size[1] > 0 && size[0] <= 16384 && size[1] <= 16384)) reject("Invalid SVG size");
  // The root is rebuilt: only these attributes survive, in a fixed order.
  const rootAttrs = new Map(root.attrs);
  for (const key of ["viewBox", "width", "height", "xmlns", "preserveAspectRatio"]) rootAttrs.delete(key);
  let aspect = options.preserveAspectRatio ?? root.attrs.get("preserveAspectRatio")?.trim();
  if (aspect !== undefined && !/^[A-Za-z ]{1,40}$/.test(aspect)) aspect = undefined;
  const body: string[] = [];
  serialize({ ...root, attrs: rootAttrs }, body, stripped, { depth: 0 });
  const head = `<svg xmlns="${NS}" viewBox="${outBox.join(" ")}" width="${size[0]}" height="${size[1]}"${aspect ? ` preserveAspectRatio="${aspect}"` : ""}`;
  // `body[0]` is "<svg" followed by the remaining attributes.
  const svg = head + body.join("").slice(4);
  return { svg, viewBox: options.viewBox ?? viewBox, stripped: [...new Set(stripped)].slice(0, 50) };
}

/** True when `text` is already exactly what the sanitizer would produce for it. */
export function isSanitizedSvg(text: string): boolean {
  try {
    return sanitizeSvg(text).svg === text;
  } catch {
    return false;
  }
}

export function demandSanitizedSvg(text: string): void {
  demand(isSanitizedSvg(text), "SVG is not in sanitized form");
}
