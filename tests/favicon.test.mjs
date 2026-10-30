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

test("every configured HTML entry resolves the shared SVG favicon within its deployment base", () => {
  assert(entries.length > 0);
  assert(base?.startsWith("/") && base.endsWith("/"), "Provide the artifact deployment base");
  const pages = Object.fromEntries(entries.map(entry => [entry, readFileSync(resolve(directory, entry), "utf8")]));
  const svg = readFileSync(resolve(root, "public/favicon.svg"), "utf8");
  const links = JSON.parse(execFileSync("python3", ["-c", `
import json,sys,xml.etree.ElementTree as ET
from html.parser import HTMLParser
class Icons(HTMLParser):
 def __init__(self): super().__init__(); self.links=[]
 def handle_starttag(self,tag,attrs):
  attrs=dict(attrs)
  if tag=='link' and 'icon' in attrs.get('rel','').lower().split(): self.links.append(attrs)
data=json.load(sys.stdin)
assert ET.fromstring(data['svg']).tag=='{http://www.w3.org/2000/svg}svg'
result={}
for name,html in data['pages'].items():
 parser=Icons(); parser.feed(html); result[name]=parser.links
print(json.dumps(result))
`], { input: JSON.stringify({ pages, svg }), encoding: "utf8" }));
  for (const entry of entries) {
    assert.equal(links[entry].length, 1, `${entry}: expected one explicit favicon`);
    const icon = links[entry][0];
    assert.equal(icon.type, "image/svg+xml", entry);
    const page = new URL(entry, `https://example.test${base}`);
    const url = new URL(icon.href, page);
    assert.equal(url.origin, page.origin, entry);
    assert.equal(url.pathname, `${base}favicon.svg`, entry);
    const resource = resolve(directory, built ? url.pathname.slice(base.length) : `public/${url.pathname.slice(1)}`);
    assert.equal(readFileSync(resource, "utf8"), svg, `${entry}: missing or different emitted favicon`);
  }
});
