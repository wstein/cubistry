// Pin, convert and verify the M/S counter data (print S3) from research PR
// #138. The research also accepts a second print, M3; the application keeps
// S3 only. No hand-edited data: every file under data/ms and the runtime
// public/ms-counter.v1.json come from this script.
//
//   node scripts/prepare-ms.mjs --check [--require-commit]
//       Verify the pinned research copies (SHA-256), that the runtime equals
//       the converter output, and, when the pinned commit is available
//       locally, that the copies are byte-identical to the research files at
//       that commit.
//   node scripts/prepare-ms.mjs --pin <commit> [--branch <branch>]
//       Re-pin in one command: fetch the branch if the commit is missing, copy
//       the research files at that commit, rewrite the hashes, convert and
//       update ms-source.json.
//   node scripts/prepare-ms.mjs
//       Regenerate the runtime from the copies.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { convertWitness, serialize, sha256 } from "./ms/convert-witness.mjs";

const root = new URL("../", import.meta.url);
const path = (p) => fileURLToPath(new URL(p, root));
const PIN = "ms-source.json";
/** Owner's limit for every saved counting step of the M/S counter. */
export const MS_EDGE_LIMIT = 4;

const R = "research/ms-counter-3move/";
/** The application's print: the research's primary witness S3 (README, "Result"). */
export const MS_PRINT = { id: "s3", label: "S3" };
const evidence = (id) => ({
  witness: `${R}evidence/witness-${id}.tsv`,
  julia: `${R}evidence/receipt-${id}.julia.tsv`,
  flix: `${R}evidence/receipt-${id}.flix.tsv`,
  checks: `${R}evidence/checks-${id}.tsv`,
});
/** Research files of the pinned print and where the app keeps a copy (null: hash only). */
export const RESEARCH_FILES = {
  [`${R}README.md`]: null,
  ...Object.fromEntries(
    Object.values(evidence(MS_PRINT.id)).map((f) => [
      f,
      `data/ms/research/${f.slice(`${R}evidence/`.length)}`,
    ]),
  ),
  [`${R}checker/check.jl`]: null,
  [`${R}checker/run-checks.sh`]: null,
  [`${R}flix/src/Main.flix`]: null,
};

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

/** Convert the pinned copies; returns the runtime object. */
export function buildRuntime(pin, read = (f) => readFileSync(path(f), "utf8")) {
  const copy = (research) => read(pin.copies[research]);
  const e = evidence(MS_PRINT.id);
  const print = convertWitness(copy(e.witness), {
    ...MS_PRINT,
    path: e.witness,
    receipts: { julia: copy(e.julia), flix: copy(e.flix) },
    checks: copy(e.checks),
  });
  if (print.maximumHTM > MS_EDGE_LIMIT)
    throw Error(`M/S print ${print.label} exceeds ${MS_EDGE_LIMIT} HTM`);
  return {
    schema: "cubistry.ms-runtime",
    version: 1,
    source: {
      repository: pin.repository,
      pullRequest: pin.pullRequest,
      branch: pin.branch,
      commit: pin.commit,
    },
    edgeLimitHTM: MS_EDGE_LIMIT,
    print,
  };
}
export const build = (pin, read) => serialize(buildRuntime(pin, read));

function writeOutputs(pin) {
  const runtime = build(pin);
  writeFileSync(path(pin.runtimePath), runtime);
  pin.runtimeSHA256 = sha256(runtime);
  writeFileSync(path(PIN), JSON.stringify(pin, null, 2) + "\n");
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
  } else if (requireCommit)
    throw Error(`Commit ${pin.commit} is not available`);
  else
    console.log(
      `Commit ${pin.commit} not available locally; checked the copies only`,
    );
  const runtime = build(pin);
  if (
    readFileSync(path(pin.runtimePath), "utf8") !== runtime ||
    sha256(runtime) !== pin.runtimeSHA256
  )
    throw Error("M/S runtime or its pin is stale; run without --check");
  console.log("M/S data is current", pin.runtimeSHA256);
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
      pullRequest: 138,
      branch: "research/ms-counter-3move",
    };
  }
  pin.runtimePath ??= "public/ms-counter.v1.json";
  if (args[0] === "--check")
    check(pin, { requireCommit: args.includes("--require-commit") });
  else if (args[0] === "--pin") {
    const b = args.indexOf("--branch");
    repin(pin, args[1], b > 0 ? args[b + 1] : undefined);
    writeOutputs(pin);
  } else writeOutputs(pin);
}
