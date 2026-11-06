import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import config from "../vite.config.mjs";

// Default unit checks inspect source only. Explicit artifact audits reuse the
// same test after a build; no browser, server or extra build runs in npm test.
const root = fileURLToPath(new URL("../", import.meta.url));
const built = Boolean(process.env.FAVICON_BUILD_DIR);
const directory = built ? resolve(root, process.env.FAVICON_BUILD_DIR) : root;
const base = built ? process.env.FAVICON_BASE_PATH : "/";
const input = config.build.rollupOptions.input;
const entries = (typeof input === "string" ? [input] : Array.isArray(input) ? input : Object.values(input))
  .map(path => relative(root, path));

const iconSet = [
  { rel: "icon", type: "image/svg+xml", file: "favicon.svg" },
  { rel: "icon", type: "image/png", sizes: "32x32", file: "favicon-32.png" },
  { rel: "icon", type: "image/png", sizes: "16x16", file: "favicon-16.png" },
  { rel: "apple-touch-icon", file: "apple-touch-icon.png" },
];
const brandFiles = ["favicon.svg", "favicon-16.png", "favicon-32.png", "favicon-48.png", "apple-touch-icon.png", "brand/cubistry-mark.svg", "brand/cubistry-mark-dark.svg"];
const pngSignature = "89504e470d0a1a0a";

test("the brand files exist and the SVGs use only plain shapes", () => {
  for (const file of brandFiles) {
    const bytes = readFileSync(resolve(root, "public", file));
    assert(bytes.length > 0, file);
    if (file.endsWith(".png")) assert.equal(bytes.subarray(0, 8).toString("hex"), pngSignature, file);
  }
  const svgs = Object.fromEntries(brandFiles.filter(file => file.endsWith(".svg")).map(file => [file, readFileSync(resolve(root, "public", file), "utf8")]));
  const problems = JSON.parse(execFileSync("python3", ["-c", `
import json,sys,re,xml.etree.ElementTree as ET
allowed={'svg':{'viewBox','role','aria-label'},
 'g':{'transform'},
 'rect':{'x','y','width','height','rx','fill','stroke','stroke-width'}}
ns='{http://www.w3.org/2000/svg}'
out={}
for name,text in json.load(sys.stdin).items():
 bad=[]
 if re.search(r'<!(DOCTYPE|ENTITY)|<\\?', text, re.I): bad.append('doctype, entity or processing instruction')
 root=ET.fromstring(text)
 if root.tag!=ns+'svg': bad.append('root is not svg')
 for el in root.iter():
  tag=el.tag.replace(ns,'') if el.tag.startswith(ns) else el.tag
  if tag not in allowed: bad.append('element '+tag); continue
  for attr in el.attrib:
   if attr not in allowed[tag]: bad.append(tag+'@'+attr)
 out[name]=bad
print(json.dumps(out))
`], { input: JSON.stringify(svgs), encoding: "utf8" }));
  assert.equal(Object.keys(problems).length, 3);
  for (const [file, bad] of Object.entries(problems)) assert.deepEqual(bad, [], file);
});

test("every configured HTML entry links the full icon set within its deployment base", () => {
  assert(entries.length > 0);
  assert(base?.startsWith("/") && base.endsWith("/"), "Provide the artifact deployment base");
  const pages = Object.fromEntries(entries.map(entry => [entry, readFileSync(resolve(directory, entry), "utf8")]));
  const links = JSON.parse(execFileSync("python3", ["-c", `
import json,sys
from html.parser import HTMLParser
class Icons(HTMLParser):
 def __init__(self): super().__init__(); self.links=[]
 def handle_starttag(self,tag,attrs):
  attrs=dict(attrs)
  rel=attrs.get('rel','').lower().split()
  if tag=='link' and ('icon' in rel or 'apple-touch-icon' in rel): self.links.append(attrs)
data=json.load(sys.stdin)
result={}
for name,html in data['pages'].items():
 parser=Icons(); parser.feed(html); result[name]=parser.links
print(json.dumps(result))
`], { input: JSON.stringify({ pages }), encoding: "utf8" }));
  for (const entry of entries) {
    assert.equal(links[entry].length, iconSet.length, `${entry}: expected exactly ${iconSet.length} icon links`);
    iconSet.forEach((want, index) => {
      const icon = links[entry][index];
      assert.equal(icon.rel, want.rel, entry);
      assert.equal(icon.type, want.type, entry);
      assert.equal(icon.sizes, want.sizes, entry);
      const page = new URL(entry, `https://example.test${base}`);
      const url = new URL(icon.href, page);
      assert.equal(url.origin, page.origin, entry);
      assert.equal(url.pathname, `${base}${want.file}`, entry);
      const resource = resolve(directory, built ? url.pathname.slice(base.length) : `public/${url.pathname.slice(1)}`);
      assert.deepEqual(readFileSync(resource), readFileSync(resolve(root, "public", want.file)), `${entry}: missing or different emitted ${want.file}`);
    });
  }
});
