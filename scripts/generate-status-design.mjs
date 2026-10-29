// Promote only the selected fixed print and finite policy catalog from a pinned research checkout.
import { readFileSync, writeFileSync, copyFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cross,
  dot,
  rotate,
  validatePrint,
} from "../packages/cube-core/src/index.ts";
import {
  applyMove,
  initialState,
  parseMove,
} from "../packages/cube-mechanics/src/index.ts";
const checkout = process.argv[2];
const pin = "6058f4dc59e36ce226f5840c2e3f5ca635a96b4a";
if (
  !checkout ||
  execFileSync("git", ["-C", checkout, "rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim() !== pin
)
  throw Error("Supply the exact reviewed research checkout");
const root = `${checkout}/research/ci-quality-cube`,
  hash = (b) => createHash("sha256").update(b).digest("hex");
const raw = readFileSync(`${root}/evidence/5-state-labeled-witnesses.json`),
  evidence = JSON.parse(raw);
const print = validatePrint(evidence.print);
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const mul = (a, b) => b.map((v) => rotate(v, a));
const transpose = (m) => [0, 1, 2].map((i) => m.map((c) => c[i]));
const axes = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];
const rotations = axes.flatMap((x) =>
  axes.filter((y) => !dot(x, y)).map((y) => [x, y, cross(x, y)]),
);
const refs = print.cubies.map((b) =>
  rotations.find((r) => eq(rotate([1, 1, 1], r), b.position)),
);
const cycle = [
  [0, 1, 0],
  [0, 0, 1],
  [1, 0, 0],
];
const poses = refs.flatMap((r) => [
  r,
  mul(r, cycle),
  mul(mul(r, cycle), cycle),
]);
const moves = ["R", "L", "U", "D", "F", "B"].flatMap((f) =>
  ["", "2", "'"].map((s) => f + s),
);
// Derive the tiny coordinate action with shared mechanics, never a second move implementation.
const transitions = poses.map((p) => {
  const orientation = mul(p, transpose(refs[0]));
  const state = {
    ...initialState(print),
    cubies: print.cubies.map((b) => ({
      id: b.id,
      position: rotate(b.position, orientation),
      orientation,
    })),
  };
  return moves.map((m) => {
    const body = applyMove(state, parseMove(m)).cubies.find((b) => b.id === 0);
    const q = poses.findIndex((pose) =>
      eq(pose, mul(body.orientation, refs[0])),
    );
    if (q < 0) throw Error("Missing shared pose");
    return q;
  });
});
const states = ["open", "running", "ok", "error", "blocked"];
const edges = [
  ["open", "running"],
  ["running", "ok"],
  ["running", "error"],
  ["error", "running"],
  ["ok", "running"],
  ["open", "error"],
  ...states.slice(1).map((s) => [s, "open"]),
  ["open", "blocked"],
  ["running", "blocked"],
  ["blocked", "running"],
];
const events = [
  {
    id: "start",
    label: "Start or retry",
    from: ["open", "ok", "error", "blocked"],
    to: "running",
  },
  { id: "passed", label: "Attempt passed", from: ["running"], to: "ok" },
  {
    id: "failed",
    label: "Attempt failed",
    from: ["open", "running"],
    to: "error",
  },
  {
    id: "blocked",
    label: "Prerequisite unavailable",
    from: ["open", "running"],
    to: "blocked",
  },
  { id: "reset", label: "Reset category", from: states.slice(1), to: "open" },
];
const categories = ["build", "test", "analyze", "review"];
const bytes = readFileSync(`${root}/evidence/distances.u8`);
if (
  hash(bytes) !==
  "f56224ee1b76e2bdaac4bb8441df5881e6b7c9a51dd6a14e62eff58e78e396d6"
)
  throw Error("Certificate hash");
mkdirSync("public/assets/quality", { recursive: true });
copyFileSync(
  `${root}/evidence/distances.u8`,
  "public/assets/quality/distances.u8",
);
const catalog = { refs, poses, moves, transitions };
writeFileSync(
  "src/apps/status/policy-catalog.json",
  JSON.stringify(catalog, null, 2) + "\n",
);
const definition = {
  schema: "cubistry.quality-application",
  version: 1,
  id: "ci-quality-cube",
  categories: categories.map((id) => ({ id, label: id.toUpperCase() })),
  states: states.map((id, i) => ({
    id,
    label: ["Open", "Running", "OK", "Error", "Blocked"][i],
    word: ["OFFEN", "LÄUFT", "OK", "FEHLER", "BLOCKIERT"][i],
  })),
  initial: ["open", "open", "open", "open"],
  print,
  assets: {
    schema: "cubistry.assets",
    version: 1,
    fonts: [],
    documents: [],
    materials: [
      { id: "sticker", color: "#ffffff", roughness: 0.7 },
      { id: "plastic", color: "#202329", roughness: 0.45 },
    ],
    images: JSON.parse(readFileSync("src/apps/status/images.json")),
  },
  edges,
  events,
  demonstration: [
    { category: "build", event: "reset" },
    { category: "build", event: "start" },
    { category: "test", event: "start" },
    { category: "build", event: "passed" },
    { category: "analyze", event: "blocked" },
    { category: "test", event: "failed" },
    { category: "test", event: "start" },
    { category: "test", event: "passed" },
    { category: "analyze", event: "start" },
    { category: "review", event: "start" },
    { category: "analyze", event: "passed" },
    { category: "review", event: "passed" },
  ],
  targets: evidence.setupWitnesses.map((w) => ({
    states: w.states.map((n) => states[n - 1]),
    setup: w.moves.join(" "),
    physicalStateSHA256: w.physicalStateSHA256,
  })),
  policy: {
    researchCommit: pin,
    authorSnapshot: "e9e544c0b2cfdffc55918e4ef9e8ef4d78d84d9b",
    witnessSHA256: hash(raw),
    certificateURL: "/assets/quality/distances.u8",
    certificateSHA256: hash(bytes),
    catalogSHA256: hash(readFileSync("src/apps/status/policy-catalog.json")),
    domain: 136080,
    singleCategoryMaximum: 6,
    arbitraryMaximum: 7,
    classification: "SAT",
    globalPrintOptimality: "UNKNOWN",
  },
};
// A demo can begin from any request; the UI resets each field explicitly before replay.
definition.demonstration = definition.demonstration.filter(
  (s) => s.event !== "reset",
);
writeFileSync(
  "src/apps/status/definition.json",
  JSON.stringify(definition, null, 2) + "\n",
);
