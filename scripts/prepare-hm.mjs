// Pin, convert and verify the H/M counter data (print m3-SH) from the research
// branch. No hand-edited data: every file under data/hm and the runtime
// public/hm-counter.v1.json come from this script.
//
//   node scripts/prepare-hm.mjs --check
//       Verify the pinned research copies (SHA-256), that the converted
//       witness and the runtime equal the converter output, and, when the
//       pinned commit is available locally, that the copies are byte-identical
//       to the research files at that commit.
//   node scripts/prepare-hm.mjs --pin <commit> [--branch <branch>]
//       Re-pin in one command: fetch the branch if the commit is missing,
//       copy the research files at that commit, rewrite the hashes, convert,
//       derive the runtime and update hm-source.json.
//   node scripts/prepare-hm.mjs
//       Regenerate the converted witness and the runtime from the copies.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { convertWitness, serialize, sha256 } from "./hm/convert-witness.mjs";
import { deriveRuntime, HSM_RUNTIME } from "./derive-hsm-runtime.mjs";

const root = new URL("../", import.meta.url);
const path = (p) => fileURLToPath(new URL(p, root));
const PIN = "hm-source.json";

/** Counting modes of the H/M application, in runtime order. */
export const HM_COUNTING_MODES = [
  ["M", 59],
  ["H", 23],
  ["H", 11],
].flatMap(([letter, maximum]) => [
  [letter, maximum, 1],
  [letter, maximum, -1],
]);
/** Owner's per-edge limit for the H/M counter. */
export const HM_EDGE_LIMIT = 4;
export const HM_RUNTIME = {
  ...HSM_RUNTIME,
  witnessSchema: "cubistry.hm-counter-modes",
  edgeLimit: HM_EDGE_LIMIT,
  modes: HM_COUNTING_MODES,
  letters: ["H", "M"],
  source: "data/hm/m3-sh/modes/witness.json",
  extended: true,
};

/** Research files of the pinned print and where the app keeps a copy (null: hash only). */
const R = "research/hm-counter-3move/";
export const RESEARCH_FILES = {
  [`${R}README.md`]: null,
  [`${R}evidence/witness-blank-m3-SH.tsv`]: "data/hm/m3-sh/research/witness-blank-m3-SH.tsv",
  [`${R}evidence/receipt-blank-m3-SH.julia.tsv`]: "data/hm/m3-sh/research/receipt-blank-m3-SH.julia.tsv",
  [`${R}evidence/receipt-blank-m3-SH.flix.tsv`]: "data/hm/m3-sh/research/receipt-blank-m3-SH.flix.tsv",
  [`${R}evidence/checks-blank-m3-SH.tsv`]: "data/hm/m3-sh/research/checks-blank-m3-SH.tsv",
  [`${R}checker/check.jl`]: null,
  [`${R}checker/run-checks.sh`]: null,
  [`${R}flix/src/Main.flix`]: null,
  [`${R}ms-import/PROVENANCE.md`]: null,
};
const WITNESS = `${R}evidence/witness-blank-m3-SH.tsv`;

const git = (...args) =>
  execFileSync("git", args, { cwd: path("."), maxBuffer: 1 << 26 });
const hasCommit = (commit) => {
  try {
    git("cat-file", "-e", `${commit}^{commit}`);
    return true;
  } catch {
    return false;
  }
};

/** Convert the pinned copies and derive the runtime; returns both texts. */
export function build(pin) {
  const read = (research) => readFileSync(path(pin.copies[research]), "utf8");
  const witness = convertWitness(read(WITNESS), {
    label: pin.print,
    source: {
      repository: pin.repository,
      branch: pin.branch,
      commit: pin.commit,
      path: WITNESS,
    },
    receipts: {
      julia: read(`${R}evidence/receipt-blank-m3-SH.julia.tsv`),
      flix: read(`${R}evidence/receipt-blank-m3-SH.flix.tsv`),
    },
    checks: read(`${R}evidence/checks-blank-m3-SH.tsv`),
  });
  const converted = serialize(witness);
  const runtime = serialize(deriveRuntime(witness, HM_RUNTIME));
  return { converted, runtime };
}

function writeOutputs(pin) {
  const { converted, runtime } = build(pin);
  writeFileSync(path(pin.convertedPath), converted);
  writeFileSync(path(pin.runtimePath), runtime);
  pin.convertedSHA256 = sha256(converted);
  pin.runtimeSHA256 = sha256(runtime);
  writeFileSync(path(PIN), JSON.stringify(pin, null, 2) + "\n");
  console.log("Wrote", pin.convertedPath, pin.convertedSHA256);
  console.log("Wrote", pin.runtimePath, pin.runtimeSHA256);
}

export function check(pin, { requireCommit = false } = {}) {
  for (const [research, digest] of Object.entries(pin.researchFiles)) {
    const copy = pin.copies[research];
    if (copy && sha256(readFileSync(path(copy))) !== digest)
      throw Error(`${copy} does not match its pin`);
  }
  if (hasCommit(pin.commit)) {
    for (const [research, digest] of Object.entries(pin.researchFiles))
      if (sha256(git("show", `${pin.commit}:${research}`)) !== digest)
        throw Error(`${research} at ${pin.commit} does not match its pin`);
    console.log("Research files match commit", pin.commit);
  } else if (requireCommit) throw Error(`Commit ${pin.commit} is not available`);
  else
    console.log(
      `Commit ${pin.commit} not available locally; checked the copies only`,
    );
  const { converted, runtime } = build(pin);
  if (
    readFileSync(path(pin.convertedPath), "utf8") !== converted ||
    sha256(converted) !== pin.convertedSHA256
  )
    throw Error("Converted witness or its pin is stale; run without --check");
  if (
    readFileSync(path(pin.runtimePath), "utf8") !== runtime ||
    sha256(runtime) !== pin.runtimeSHA256
  )
    throw Error("H/M runtime or its pin is stale; run without --check");
  console.log("H/M data is current", pin.runtimeSHA256);
}

function repin(pin, commitish, branch) {
  pin.branch = branch ?? pin.branch;
  if (!hasCommit(commitish)) git("fetch", "origin", pin.branch);
  pin.commit = git("rev-parse", `${commitish}^{commit}`).toString().trim();
  pin.researchFiles = {};
  pin.copies = {};
  for (const [research, copy] of Object.entries(RESEARCH_FILES)) {
    const bytes = git("show", `${pin.commit}:${research}`);
    pin.researchFiles[research] = sha256(bytes);
    if (copy) {
      mkdirSync(dirname(path(copy)), { recursive: true });
      writeFileSync(path(copy), bytes);
      pin.copies[research] = copy;
    }
  }
  console.log("Pinned", pin.branch, pin.commit);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  let pin;
  try {
    pin = JSON.parse(readFileSync(path(PIN), "utf8"));
  } catch {
    pin = {
      repository: "https://github.com/wstein/cubistry",
      pullRequest: 133,
      branch: "research/hm-counter-3move",
      print: "m3-SH",
    };
  }
  pin.convertedPath ??= "data/hm/m3-sh/modes/witness.json";
  pin.runtimePath ??= "public/hm-counter.v1.json";
  if (args[0] === "--check") check(pin, { requireCommit: args.includes("--require-commit") });
  else if (args[0] === "--pin") {
    const b = args.indexOf("--branch");
    repin(pin, args[1], b > 0 ? args[b + 1] : undefined);
    mkdirSync(dirname(path(pin.convertedPath)), { recursive: true });
    writeOutputs(pin);
  } else writeOutputs(pin);
}
