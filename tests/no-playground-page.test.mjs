import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

// Picture Cube host plan, D5 (knowledge/plans/unified-application.md): playground.html is gone and its URL answers 404
// (no redirect, no shim). The Picture Cube is the host mode index.html?app=playground. picture3.html stays until its slice.

test("playground.html and its entry script do not exist and vite does not build them", () => {
  assert(!existsSync(resolve("playground.html")));
  assert(!existsSync(resolve("src/playground.mjs")));
  const vite = readFileSync(resolve("vite.config.mjs"), "utf8");
  assert(!vite.includes("playground.html"));
  assert(!/^\s*playground:/m.test(vite));
});

test("the host mode still reaches the Picture Cube under its new URL", () => {
  const main = readFileSync(resolve("src/main.mjs"), "utf8");
  assert(main.includes('"playground": "index.html?app=playground"'));
  assert(existsSync(resolve("src/apps/playground/mount.ts")));
});

test("no HTML page, script, test, doc or workflow names playground.html or src/playground.mjs", () => {
  const skip = new Set(["node_modules", ".git", "dist", ".worktrees"]);
  const walk = (dir) =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      skip.has(e.name) ? [] : e.isDirectory() ? walk(`${dir}/${e.name}`) : [`${dir}/${e.name}`],
    );
  const hits = [];
  const files = [...readdirSync(".").filter((f) => /\.(html|md|mjs)$/.test(f))];
  for (const root of ["src", "scripts", "docs", "tests", ".github", "public"]) {
    if (existsSync(root)) files.push(...walk(root));
  }
  for (const f of files) {
    // tests/pages/playground.spec.mjs names the old URL on purpose: it is the built-output 404 check.
    if (/\.(png|jpe?g|svg|woff2?|bin|pdf|ico|wasm|gz|zip|webp)$/i.test(f) || f.endsWith("no-playground-page.test.mjs") || f.endsWith("tests/pages/playground.spec.mjs")) continue;
    const text = readFileSync(f, "utf8");
    if (/playground\.html|src\/playground\.mjs|\/playground\.mjs/.test(text)) hits.push(f);
  }
  assert.deepEqual(hits, []);
});

test("no page offers the removed Picture Puzzle Playground chooser entry", () => {
  for (const f of readdirSync(".").filter((n) => n.endsWith(".html"))) {
    const html = readFileSync(resolve(f), "utf8");
    assert(!/<option value="playground\.html"/.test(html), `${f}: playground.html option`);
  }
});
