// Derive the runtime print and counting periods from the pinned seconds-first
// witness. The witness copy under data/hsm is byte-pinned by hsm-source.json.
//   node scripts/derive-hsm-runtime.mjs          # rewrite runtime file and its pin
//   node scripts/derive-hsm-runtime.mjs --check  # fail when either is stale
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const path = (p) => fileURLToPath(new URL(p, root));
export const sha256 = (bytes) =>
  createHash("sha256").update(bytes).digest("hex");

/** Only the +1 periods are used: -1 traverses the same period backward. */
export const COUNTING_PERIODS = [
  ["S", 59],
  ["M", 59],
  ["H", 23],
  ["H", 11],
];

export function deriveRuntime(witness) {
  if (
    witness.schema !== "cubistry.hsm-seconds-first" ||
    witness.version !== 1 ||
    witness.printing?.length !== 24
  )
    throw Error("Unexpected seconds-first witness");
  const periods = COUNTING_PERIODS.map(([letter, maximum]) => {
    const mode = witness.modes.find(
      (m) => m.letter === letter && m.maximum === maximum && m.direction === 1,
    );
    if (!mode) throw Error(`Missing witness mode ${letter}/${maximum}/+1`);
    const n = mode.steps.length;
    if (
      n !== mode.periodEdges ||
      n % (maximum + 1) !== 0 ||
      mode.periodStart !== 0 ||
      mode.steps.some(
        (s, i) =>
          s.from !== i % (maximum + 1) ||
          s.to !== (i + 1) % (maximum + 1) ||
          !s.word,
      )
    )
      throw Error(`Malformed witness period ${letter}/${maximum}`);
    return {
      letter,
      maximum,
      setup: mode.setup,
      periodHTM: mode.periodHTM,
      words: mode.steps.map((s) => s.word),
    };
  });
  // Each letter's primary setup is its first listed period.
  const zeroWords = {};
  for (const p of periods) zeroWords[p.letter] ??= p.setup;
  return {
    schema: "cubistry.hsm-runtime",
    version: 3,
    source: "data/hsm/seconds-first/witness.json",
    zeroWords: { H: zeroWords.H, S: zeroWords.S, M: zeroWords.M },
    printing: witness.printing,
    periods,
  };
}
export const serialize = (runtime) => JSON.stringify(runtime, null, 2) + "\n";

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const pinPath = path("hsm-source.json"),
    pin = JSON.parse(readFileSync(pinPath, "utf8")),
    witnessBytes = readFileSync(path(pin.appCopy));
  if (sha256(witnessBytes) !== pin.layoutSHA256)
    throw Error("Witness copy does not match its pin");
  const text = serialize(deriveRuntime(JSON.parse(witnessBytes))),
    digest = sha256(text);
  if (process.argv.includes("--check")) {
    if (
      readFileSync(path(pin.runtimePath), "utf8") !== text ||
      pin.runtimeSHA256 !== digest
    )
      throw Error("Runtime file or pin is stale; run without --check");
    console.log("HSM runtime is current", digest);
  } else {
    writeFileSync(path(pin.runtimePath), text);
    pin.runtimeSHA256 = digest;
    writeFileSync(pinPath, JSON.stringify(pin, null, 2) + "\n");
    console.log("Wrote", pin.runtimePath, digest);
  }
}
