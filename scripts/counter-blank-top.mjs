// Pins and derives the blank-top 00-99 counter print (Counter variant).
// The research files under data/counter/blank-top are byte copies, pinned by
// counter-blank-top-source.json to research/counter-99-blank-top at a fixed
// commit. The application runtime is derived from those copies, never edited.
//   node scripts/counter-blank-top.mjs           # rewrite runtime file and its pin
//   node scripts/counter-blank-top.mjs --check   # fail when a copy, pin or runtime is stale
//   node scripts/counter-blank-top.mjs --copy    # recopy data from the pinned commit (needs it fetched)
// This script is a provenance and format tool, not a proof checker: the
// native Julia and Flix checkers on the research branch are the authority.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const path = (p) => fileURLToPath(new URL(p, root));
export const sha256 = (bytes) =>
  createHash("sha256").update(bytes).digest("hex");
export const PIN_PATH = "counter-blank-top-source.json";
export const PINNED_COMMIT = "22fe5842c4c59e54789c865914e70abb7cfcb24c";
const DATA = "data/counter/blank-top/";

/** Inverse of a word in the research notation: reversed, each turn undone. */
export const inverseWord = (word) =>
  word
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .reverse()
    .map((m) => (m.endsWith("'") ? m[0] : m.endsWith("2") ? m : m + "'"))
    .join(" ");
const htm = (word) => word.trim().split(/\s+/).filter(Boolean).length;
const MOVE = /^[RLUDFB](2|')?$/;

/** Parse a research TSV (header row, tab separated, trailing newline). */
export function parseTsv(text) {
  const lines = text.split("\n");
  if (lines.at(-1) !== "") throw Error("TSV must end with a newline");
  lines.pop();
  const header = lines.shift().split("\t");
  return lines.map((line) => {
    const cells = line.split("\t");
    if (cells.length !== header.length) throw Error("Ragged TSV row: " + line);
    return Object.fromEntries(header.map((h, i) => [h, cells[i]]));
  });
}
const vec = (text) => {
  const v = text.split(",").map(Number);
  if (v.length !== 3 || v.some((n) => ![-1, 0, 1].includes(n)))
    throw Error("Invalid vector " + text);
  return v;
};
const same = (a, b) => a.every((v, i) => v === b[i]);
/** A deterministic tangent for blank stickers; blanks match in any quarter turn. */
export const blankUp = (n) => (Math.abs(n[1]) === 1 ? [0, 0, -n[1]] : [0, 1, 0]);

/**
 * Map the research print onto the titled counter's canonical source geometry:
 * every app sticker keeps its sticker ID, cubie ID and outward normal, and
 * takes the research artwork and print-up vector found at that position.
 */
export function derivePrinting(printRows, canonical) {
  if (printRows.length !== 24) throw Error("Blank-top print needs 24 stickers");
  const research = printRows.map((r, i) => {
    if (Number(r.sticker) !== i) throw Error("Research sticker order changed");
    const blank = r.artwork === "blank";
    if (!blank && !/^[0-9]$/.test(r.artwork)) throw Error("Invalid artwork");
    if (blank !== (r.up === "-")) throw Error("Blank stickers carry no up");
    return {
      index: i,
      p: vec(r.position),
      n: vec(r.normal),
      image: blank ? "blank" : r.artwork,
      up: blank ? null : vec(r.up),
    };
  });
  const used = new Set();
  const printing = canonical.stickers.map((s) => {
    const cubie = canonical.cubies.find((c) => c.id === s.cubie);
    const match = research.filter(
      (r) => same(r.p, cubie.position) && same(r.n, s.normal),
    );
    if (match.length !== 1) throw Error("Unmatched canonical sticker " + s.id);
    const r = match[0];
    used.add(r.index);
    return {
      id: s.id,
      cubie: s.cubie,
      p: [...cubie.position],
      n: [...s.normal],
      up: r.up ?? blankUp(r.n),
      image: r.image,
      researchSticker: r.index,
    };
  });
  if (used.size !== 24) throw Error("Research stickers not covered exactly once");
  const blanks = printing.filter((s) => s.image === "blank").length;
  const digits = printing.filter((s) => s.image !== "blank");
  if (blanks !== 4 || digits.length !== 20) throw Error("Expected 4 blanks and 20 digits");
  for (const d of "0123456789")
    if (digits.filter((s) => s.image === d).length !== 2)
      throw Error("Each digit needs one tens and one units sticker");
  return printing;
}

/** Check one mode's research rows and keep only the increment words. */
export function deriveMode(mode, routeRows, setupRows) {
  if (routeRows.length !== 100) throw Error(`${mode} needs 100 edges`);
  const label = (v) =>
    mode === "nz" && v < 10 ? "_" + v : String(v).padStart(2, "0");
  const increments = routeRows.map((r, i) => {
    if (
      r.mode !== mode ||
      Number(r.step) !== i ||
      r.from !== label(i) ||
      r.to !== label((i + 1) % 100)
    )
      throw Error(`${mode} edge ${i} out of order`);
    const words = [r.increment, r.decrement];
    if (!words.every((w) => w.split(" ").every((m) => MOVE.test(m))))
      throw Error(`${mode} edge ${i} has invalid notation`);
    if (Number(r.inc_htm) !== htm(r.increment) || Number(r.dec_htm) !== htm(r.decrement))
      throw Error(`${mode} edge ${i} HTM claim differs from its word`);
    if (r.decrement !== inverseWord(r.increment))
      throw Error(`${mode} edge ${i} decrement is not the inverse word`);
    return r.increment;
  });
  if (setupRows.length !== 1 || setupRows[0].mode !== mode)
    throw Error(`${mode} needs exactly one setup row`);
  const setup = setupRows[0].setup;
  if (Number(setupRows[0].htm) !== htm(setup))
    throw Error(`${mode} setup HTM claim differs from its word`);
  const lengths = increments.map(htm);
  return {
    mode,
    leadingZero: mode === "lz",
    setup,
    setupHTM: htm(setup),
    increments,
    totalHTM: lengths.reduce((a, b) => a + b, 0),
    maximumHTM: Math.max(...lengths),
  };
}

export function deriveRuntime(files, canonical) {
  const lz = deriveMode("lz", parseTsv(files["routes-lz.tsv"]), parseTsv(files["setup-lz.tsv"]));
  const nz = deriveMode("nz", parseTsv(files["routes-nz.tsv"]), parseTsv(files["setup-nz.tsv"]));
  if (lz.setup !== "") throw Error("LZ must start from the printed state");
  return {
    schema: "cubistry.counter-blank-top",
    version: 1,
    puzzle: "2x2x2",
    source: {
      pin: PIN_PATH,
      commit: PINNED_COMMIT,
      files: Object.fromEntries(
        ["print.tsv", "routes-lz.tsv", "routes-nz.tsv", "setup-lz.tsv", "setup-nz.tsv"].map(
          (f) => [DATA + f, sha256(files[f])],
        ),
      ),
    },
    printing: derivePrinting(parseTsv(files["print.tsv"]), canonical),
    modes: [lz, nz],
    // LZ shows 00 in the printed state, so the NZ setup is also the switch
    // from LZ 00 to NZ _0; the way back is its inverse word.
    modeSwitch: { from: "lz", to: "nz", value: 0, word: nz.setup, htm: nz.setupHTM },
  };
}
export const serialize = (runtime) => JSON.stringify(runtime, null, 2) + "\n";

function readCopies(pin) {
  const files = {};
  for (const [copy, research] of Object.entries(pin.appCopies)) {
    const bytes = readFileSync(path(copy));
    if (sha256(bytes) !== pin.researchFiles[research])
      throw Error(`${copy} does not match its pinned research file`);
    files[copy.slice(DATA.length)] = bytes.toString("utf8");
  }
  return files;
}
function commitAvailable(commit) {
  try {
    execFileSync("git", ["cat-file", "-e", `${commit}^{commit}`], { cwd: path("."), stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}
const gitShow = (commit, file) =>
  execFileSync("git", ["show", `${commit}:${file}`], { cwd: path("."), maxBuffer: 1 << 24 });

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const pin = JSON.parse(readFileSync(path(PIN_PATH), "utf8"));
  if (pin.commit !== PINNED_COMMIT || pin.branch !== "research/counter-99-blank-top")
    throw Error("Unexpected research pin");
  if (process.argv.includes("--copy")) {
    if (!commitAvailable(pin.commit))
      throw Error(`Fetch ${pin.branch} first: git fetch origin ${pin.branch}`);
    for (const [copy, research] of Object.entries(pin.appCopies)) {
      const bytes = gitShow(pin.commit, research);
      if (sha256(bytes) !== pin.researchFiles[research]) throw Error(`${research} differs from its pin`);
      mkdirSync(dirname(path(copy)), { recursive: true });
      writeFileSync(path(copy), bytes);
    }
    console.log("Copied", Object.keys(pin.appCopies).length, "pinned research files");
  }
  // With the research commit present, every pinned research file is checked
  // too; CI's shallow clone usually lacks it, so the copies' pins still hold.
  if (commitAvailable(pin.commit)) {
    for (const [research, digest] of Object.entries(pin.researchFiles))
      if (sha256(gitShow(pin.commit, research)) !== digest)
        throw Error(`${research} at ${pin.commit} differs from its pin`);
    console.log("Research files match the pinned commit", pin.commit);
  } else console.log("Pinned research commit not fetched; checked the app copies only");
  const canonical = JSON.parse(readFileSync(path(pin.canonicalSource.path), "utf8")).prints.padded;
  const text = serialize(deriveRuntime(readCopies(pin), canonical)),
    digest = sha256(text);
  if (process.argv.includes("--check")) {
    if (readFileSync(path(pin.runtimePath), "utf8") !== text || pin.runtimeSHA256 !== digest)
      throw Error("Blank-top runtime file or pin is stale; run without --check");
    console.log("Blank-top counter runtime is current", digest);
  } else {
    writeFileSync(path(pin.runtimePath), text);
    pin.runtimeSHA256 = digest;
    writeFileSync(path(PIN_PATH), JSON.stringify(pin, null, 2) + "\n");
    console.log("Wrote", pin.runtimePath, digest);
  }
}
