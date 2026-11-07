/**
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Usage: node scripts/check-art-generators.mjs
 * Re-runs every picture-art generator (scripts/build-*-art.mjs) in a scratch copy and fails when any
 * file it writes differs byte for byte from the committed one. Nothing in the repository is written.
 * Excluded: src/apps/playground/picture-assets.ts, because the committed copy is hand-formatted (same
 * data, different whitespace and quoting); its SVG inputs are still compared.
 */
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const repo = resolve(fileURLToPath(new URL("..", import.meta.url)));
const SKIP = new Set(["src/apps/playground/picture-assets.ts"]);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

function snapshot(tmp) {
  return ["public", "src", "assets"].flatMap((top) => walk(join(tmp, top)));
}

/** Generators that wrote nothing, and committed faces (public/playground*, F B R L U D .svg) that a generator of that directory did not write (space has no generator). */
export function missingOutputs({ files, perGenerator }, root = repo) {
  const bad = Object.entries(perGenerator).filter(([, n]) => n === 0).map(([g]) => `${g} wrote no files`);
  for (const d of readdirSync(join(root, "public")).filter((n) => n.startsWith("playground") && [...files.keys()].some((f) => f.startsWith(`public/${n}/`)))) {
    for (const face of "FBRLUD") {
      const rel = `public/${d}/${face}.svg`;
      if (existsSync(join(root, rel)) && !files.has(rel)) bad.push(`not generated: ${rel}`);
    }
  }
  return bad;
}

/** Runs the generators in a scratch tree and returns Map(repo-relative path -> Buffer) of what they wrote. */
export function generateAll() {
  const tmp = mkdtempSync(join(tmpdir(), "art-gen-"));
  try {
    mkdirSync(join(tmp, "scripts"));
    mkdirSync(join(tmp, "src/apps/playground"), { recursive: true });
    mkdirSync(join(tmp, "assets/playground-pastel-proposals"), { recursive: true });
    for (const d of readdirSync(join(repo, "public"))) {
      if (d.startsWith("playground")) mkdirSync(join(tmp, "public", d), { recursive: true });
    }
    const seen = new Set();
    const perGenerator = {};
    const gens = readdirSync(join(repo, "scripts")).filter((f) => /^build-.+-art\.mjs$/.test(f)).sort();
    for (const g of gens) {
      cpSync(join(repo, "scripts", g), join(tmp, "scripts", g));
      const r = spawnSync(process.execPath, [join("scripts", g)], { cwd: tmp, encoding: "utf8" });
      if (r.status !== 0) throw Error(`${g} failed:\n${r.stderr}`);
      const now = snapshot(tmp);
      perGenerator[g] = now.filter((f) => !seen.has(f)).length;
      for (const f of now) seen.add(f);
    }
    const files = new Map();
    for (const top of ["public", "src", "assets"]) {
      for (const f of walk(join(tmp, top))) {
        const rel = relative(tmp, f).split(sep).join("/");
        if (!SKIP.has(rel)) files.set(rel, readFileSync(f));
      }
    }
    return { files, generators: gens, perGenerator };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

/** Returns the repo-relative paths whose committed bytes differ from (or are missing against) the generated ones. */
export function diffAgainst(files, root = repo) {
  const bad = [];
  for (const [rel, buf] of files) {
    const p = join(root, rel);
    if (!existsSync(p) || !readFileSync(p).equals(buf)) bad.push(rel);
  }
  return bad;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const gen = generateAll();
  const { files, generators } = gen;
  const bad = [...diffAgainst(files), ...missingOutputs(gen)];
  for (const rel of bad) console.error(`Out of date: ${rel}`);
  console.log(`${generators.length} generators, ${files.size} files compared, ${bad.length} differ`);
  process.exit(bad.length ? 1 : 0);
}
