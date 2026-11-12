import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

// Stage 3 of knowledge/plans/unified-application.md: chronocube.html is gone, index.html?app=<id> hosts the modes,
// and nothing links to the old page or builds it (owner: no redirects, no shims).

test("chronocube.html does not exist and vite does not build it", () => {
  assert(!existsSync(resolve("chronocube.html")));
  const vite = readFileSync(resolve("vite.config.mjs"), "utf8");
  assert(!vite.includes("chronocube.html"));
  assert(!/^\s*chronocube:/m.test(vite));
});

test("no HTML page, script or test source names chronocube.html", () => {
  const files = [
    ...readdirSync(".").filter((f) => f.endsWith(".html")),
    "src/main.mjs",
    "src/shell/shell.css",
    "vite.config.mjs",
  ];
  for (const f of files) assert(!readFileSync(resolve(f), "utf8").includes("chronocube.html"), f);
  for (const f of readdirSync("tests", { recursive: true })) {
    if (f === "no-chronocube-page.test.mjs" || !/\.(mjs|ts)$/.test(f)) continue;
    assert(!readFileSync(resolve("tests", f), "utf8").includes("chronocube.html"), `tests/${f}`);
  }
});

test("scripts, docs, workflows, public files and src name no chronocube.html", () => {
  const skip = new Set(["node_modules", ".git", "dist", ".worktrees"]);
  const walk = (dir) =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      skip.has(e.name) ? [] : e.isDirectory() ? walk(`${dir}/${e.name}`) : [`${dir}/${e.name}`],
    );
  const hits = [];
  for (const root of ["src", "scripts", "docs", ".github", "public"]) {
    if (!existsSync(root)) continue;
    for (const f of walk(root)) {
      // Skip binary fonts and archives; .svg stays text and is scanned.
      if (/\.(png|jpe?g|woff2?|ttf|otf|u8|bin|pdf|ico|wasm|gz|zip)$/i.test(f)) continue;
      if (readFileSync(f, "utf8").includes("chronocube.html")) hits.push(f);
    }
  }
  assert.deepEqual(hits, []);
});

test("the studio switcher has no branch for page links", () => {
  assert(!readFileSync(resolve("src/chronocube.mjs"), "utf8").includes("location.assign("));
});

test("no page offers the removed chronocube chooser entries", () => {
  for (const f of readdirSync(".").filter((n) => n.endsWith(".html"))) {
    const html = readFileSync(resolve(f), "utf8");
    assert(!/<option value="chronocube"/.test(html), `${f}: hidden chronocube option`);
    assert(!html.includes("Integrated Studio"), `${f}: Integrated Studio group`);
  }
  assert(!readFileSync(resolve("src/main.mjs"), "utf8").includes('"chronocube":'));
});
