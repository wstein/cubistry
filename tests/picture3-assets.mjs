// Standalone Node/static packaging audit; no browser or E2E execution.
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import { createCube3Design, apply, scrambleWord } from "../src/apps/picture3/model.ts";
import { apply as independentlyApply } from "../src/apps/calendar/transition/geometry.mjs";
import { scramble } from "../src/apps/playground/model.ts";
const directory = resolve(process.argv[2] ?? "dist"), base = process.argv[3] ?? "/";
assert(/^\/(?:[A-Za-z0-9_-]+\/)*$/.test(base), "Provide the built deployment base");
const html = readFileSync(join(directory, "picture3.html"), "utf8");
const resources = JSON.parse(execFileSync("python3", ["-c", `
from html.parser import HTMLParser
import sys,json
class Resources(HTMLParser):
 def __init__(self): super().__init__(); self.urls=[]
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if tag=='script' and a.get('src'): self.urls.append(a['src'])
  if tag=='link' and a.get('href'): self.urls.append(a['href'])
p=Resources();p.feed(sys.stdin.read());print(json.dumps(p.urls))
`], { input: html, encoding: "utf8" }));
assert(resources.length > 2);
for (const resource of resources) {
  assert(resource.startsWith(base), resource);
  assert(existsSync(join(directory, resource.slice(base.length))), resource);
}
const assets = join(directory, "assets"), files = readdirSync(assets);
const workers = files.filter(file => /^solver-worker-.*\.js$/.test(file)); assert.equal(workers.length, 1);
const page = files.find(file => /^picture3-.*\.js$/.test(file)); assert(page);
assert(readFileSync(join(assets, page), "utf8").includes(base + "assets/" + workers[0]));
const design = createCube3Design(), from = apply(design.printing, scrambleWord(scramble(44, 20)));
const timer = setTimeout(() => { console.error("Compiled worker deadline exceeded"); process.exit(1); }, 20000);
try {
  const result = new Promise(resolve => { globalThis.self = { postMessage: resolve }; });
  await import(pathToFileURL(join(assets, workers[0])).href);
  await globalThis.self.onmessage({ data: { design, from } });
  const response = await result;
  assert(!response.error, response.error);
  assert.deepEqual(independentlyApply(from, response.word), design.printing);
  clearTimeout(timer);
  console.log(JSON.stringify({ base, entryResources: resources.length, compiledWorkerAndNestedImports: true,
    seed44All54Exact: true, moves: response.word.split(/\s+/).filter(Boolean).length, browserRun: false }));
  process.exit(0); // End the actual nested ordinary-solver worker threads.
} catch (error) { clearTimeout(timer); console.error(error); process.exit(1); }
