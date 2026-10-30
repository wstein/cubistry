// Derive the application runtime (print and the counting periods of all 18
// modes) from the pinned seconds-first modes witness, and check the frozen
// print source of the committed print sheets. The witness copies under
// data/hsm are byte-pinned by hsm-source.json.
//   node scripts/derive-hsm-runtime.mjs          # rewrite runtime file and its pin
//   node scripts/derive-hsm-runtime.mjs --check  # fail when either is stale
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const path = (p) => fileURLToPath(new URL(p, root));
export const sha256 = (bytes) =>
  createHash("sha256").update(bytes).digest("hex");

/**
 * Every application counting mode, in runtime order. Each letter's first entry
 * is the period whose setup is the letter's 00 setup (unchanged from the four
 * periods published first, so the print bundles keep their setup examples).
 */
export const COUNTING_MODES = [
  ["S", 59],
  ["S", 23],
  ["S", 11],
  ["M", 59],
  ["M", 23],
  ["M", 11],
  ["H", 23],
  ["H", 11],
  ["H", 59],
].flatMap(([letter, maximum]) => [
  [letter, maximum, 1],
  [letter, maximum, -1],
]);
/** Inverse of a word in the research notation: reversed, each turn undone. */
export const inverseWord = (word) =>
  word
    .split(" ")
    .reverse()
    .map((m) => (m.endsWith("'") ? m[0] : m.endsWith("2") ? m : m + "'"))
    .join(" ");
const EDGE_LIMIT = 5;

export function deriveRuntime(witness) {
  if (
    witness.schema !== "cubistry.hsm-seconds-first-modes" ||
    witness.version !== 1 ||
    witness.edgeLimitHTM !== EDGE_LIMIT ||
    witness.printing?.length !== 24
  )
    throw Error("Unexpected seconds-first modes witness");
  const own = (letter, maximum, direction) => {
    const mode = witness.modes.find(
      (m) =>
        m.letter === letter &&
        m.maximum === maximum &&
        m.direction === direction,
    );
    if (!mode)
      throw Error(`Missing witness mode ${letter}/${maximum}/${direction}`);
    const n = mode.steps.length;
    if (
      n !== mode.periodEdges ||
      n % (maximum + 1) !== 0 ||
      mode.periodStart !== 0 ||
      mode.maximumHTM > EDGE_LIMIT ||
      mode.steps.some(
        (s, i) =>
          s.from !==
            (((i * direction) % (maximum + 1)) + maximum + 1) % (maximum + 1) ||
          s.to !==
            ((((i + 1) * direction) % (maximum + 1)) + maximum + 1) %
              (maximum + 1) ||
          !s.word ||
          s.word.split(" ").length > EDGE_LIMIT,
      )
    )
      throw Error(`Malformed witness period ${letter}/${maximum}/${direction}`);
    return mode;
  };
  const periods = COUNTING_MODES.map(([letter, maximum, direction]) => {
    const app = witness.appModes.find(
      (m) =>
        m.letter === letter &&
        m.maximum === maximum &&
        m.direction === direction,
    );
    if (!app || ![1, -1].includes(app.sourceDirection))
      throw Error(`Missing application mode ${letter}/${maximum}/${direction}`);
    const source = own(letter, maximum, app.sourceDirection),
      forward = app.sourceDirection === direction;
    if (app.traversal !== (forward ? "forward" : "inverse"))
      throw Error(`Inconsistent traversal ${letter}/${maximum}/${direction}`);
    // Run backward, the period visits the same full poses in reverse order and
    // every word is inverted; node 0 (display 00) and its setup are shared.
    const words = forward
      ? source.steps.map((s) => s.word)
      : source.steps
          .slice()
          .reverse()
          .map((s) => inverseWord(s.word));
    return {
      letter,
      maximum,
      direction,
      traversal: app.traversal,
      setup: source.setup,
      periodHTM: source.periodHTM,
      words,
    };
  });
  // Each letter's primary setup is its first listed period.
  const zeroWords = {};
  for (const p of periods) zeroWords[p.letter] ??= p.setup;
  return {
    schema: "cubistry.hsm-runtime",
    version: 4,
    source: "data/hsm/seconds-first/modes/witness.json",
    zeroWords: { H: zeroWords.H, S: zeroWords.S, M: zeroWords.M },
    printing: witness.printing,
    periods,
  };
}
/**
 * The frozen print source: public/hsm-counter.v2.json, derived from the base
 * seconds-first witness with its four +1 periods (runtime schema version 3).
 * The committed print sheets pin its bytes, so it never changes; the
 * application loads the version 4 runtime instead.
 */
export const PRINT_SOURCE_PERIODS = [
  ["S", 59],
  ["M", 59],
  ["H", 23],
  ["H", 11],
];

export function derivePrintSource(witness) {
  if (
    witness.schema !== "cubistry.hsm-seconds-first" ||
    witness.version !== 1 ||
    witness.printing?.length !== 24
  )
    throw Error("Unexpected seconds-first witness");
  const periods = PRINT_SOURCE_PERIODS.map(([letter, maximum]) => {
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
    witnessBytes = readFileSync(path(pin.appCopy)),
    baseBytes = readFileSync(path(pin.printSource.derivedFrom));
  if (sha256(witnessBytes) !== pin.layoutSHA256)
    throw Error("Witness copy does not match its pin");
  if (sha256(baseBytes) !== pin.printSource.derivedFromSHA256)
    throw Error("Base witness copy does not match its pin");
  // The print source is frozen: it is only ever checked, never rewritten.
  const source = serialize(derivePrintSource(JSON.parse(baseBytes)));
  if (
    readFileSync(path(pin.printSource.path), "utf8") !== source ||
    sha256(source) !== pin.printSource.sha256
  )
    throw Error("Print source differs from its frozen derivation");
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
