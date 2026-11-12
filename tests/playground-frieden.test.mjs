import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { THEMES, FACE_IDS } from "../src/apps/playground/themes.ts";

const root = new URL("../", import.meta.url);
const frieden = THEMES.find((t) => t.id === "frieden");

test("Frieden is a registered picture theme with six WebP faces within the working edge", () => {
  assert.ok(frieden, "the registry has a `frieden` entry");
  assert.equal(frieden.name, "Frieden");
  let total = 0;
  for (const face of FACE_IDS) {
    const { url, format, size } = frieden.faces[face];
    assert.equal(url, `/playground-frieden/${face}.webp`);
    assert.equal(format, "webp");
    assert.ok(size >= 2 && size <= 1024, `${face}: ${size} px is within the 1024 px working edge`);
    const bytes = statSync(new URL(`public${url}`, root)).size;
    assert.ok(bytes <= 262144, `${face}: ${bytes} bytes exceed the asset loader's per-file limit`);
    total += bytes;
  }
  assert.ok(total <= 4194304, `${total} bytes exceed the asset loader's per-set limit`);
});

test("every theme directory carries a NOTICE with the CC BY-SA 4.0 license and its link", () => {
  const dirs = readdirSync(new URL("public/", root)).filter((d) => /^playground-[a-z]+$/.test(d));
  assert.ok(dirs.includes("playground-frieden"));
  for (const dir of dirs) {
    const notice = readFileSync(new URL(`public/${dir}/NOTICE.txt`, root), "utf8");
    assert.match(notice, /CC BY-SA 4\.0/, dir);
    assert.ok(notice.includes("https://creativecommons.org/licenses/by-sa/4.0/"), dir);
    assert.ok(notice.includes("SPDX-License-Identifier: CC-BY-SA-4.0"), dir);
  }
});

test("the Frieden NOTICE states the provenance line verbatim and the inventory lists the theme", () => {
  const notice = readFileSync(new URL("public/playground-frieden/NOTICE.txt", root), "utf8");
  assert.ok(notice.includes("KI-generierte Illustrationen, erstellt mit OpenAI. Auswahl und Zusammenstellung: Werner Stein, 2026."));
  const inventory = readFileSync(new URL("THIRD_PARTY_NOTICES.md", root), "utf8");
  assert.ok(inventory.includes("public/playground-frieden/NOTICE.txt"));
});

test("the playground document lists every registered theme", () => {
  const doc = readFileSync(new URL("docs/PICTURE_PLAYGROUND.md", root), "utf8");
  for (const t of THEMES) assert.ok(doc.includes(`- \`${t.id}\`, ${t.name}:`), `${t.id} is listed`);
});

test("the generated manifest and typed face list are current", () => {
  const r = spawnSync(process.execPath, ["scripts/build-playground-theme.mjs", "--check", "frieden"], { cwd: new URL(".", root), encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
});
