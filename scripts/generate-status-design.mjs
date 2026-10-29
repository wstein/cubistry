// Construct six immutable face prints from legal opposite-layer setup words.
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { validatePrint } from "../packages/cube-core/src/index.ts";
import {
  POSITIONS,
  applyMoves,
  initialState,
  parseAlg,
  stickerPoses,
} from "../packages/cube-mechanics/src/index.ts";

const specifications = [
  ["idle", "Idle", "IDLE", "", "#43576b"],
  ["planning", "Planning", "PLAN", "U D'", "#624aa2"],
  ["coding", "Coding", "CODE", "U2 D2", "#1b6693"],
  ["testing", "Testing", "TEST", "U' D", "#85600b"],
  ["review", "Review", "REVW", "R L'", "#9f4c2d"],
  ["done", "Done", "DONE", "R' L", "#25684c"],
];
const front = [
  [-1, 1, 1],
  [1, 1, 1],
  [-1, -1, 1],
  [1, -1, 1],
];
const normals = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];
const same = (a, b) => a.every((v, i) => v === b[i]);
const stickers = POSITIONS.flatMap((position, cubie) =>
  normals
    .filter((n) => n.reduce((s, v, i) => s + v * position[i], 0) === 1)
    .map((normal) => ({
      cubie,
      normal,
      up: normal[1] ? [0, 0, 1] : [0, 1, 0],
    })),
).map((s, id) => ({
  ...s,
  id,
  assetId: `placeholder-${id}`,
  materialId: "sticker",
  equivalentQuarterTurns: [0],
}));
const source = validatePrint({
  schema: "cubistry.print",
  version: 1,
  id: "status-workflow-v1",
  topology: { kind: "cube", size: 2 },
  cubies: POSITIONS.map((position, id) => ({ id, position })),
  stickers,
});
const documents = [],
  images = [],
  statuses = [],
  assigned = new Set();
for (const [id, label, faceLabel, setup, background] of specifications) {
  const state = applyMoves(initialState(source), parseAlg(setup));
  const poses = stickerPoses(source, state);
  const assetIds = [];
  front.forEach((position, slot) => {
    const pose = poses.find((s) => same(s.p, position) && same(s.n, [0, 0, 1]));
    if (!pose || assigned.has(pose.id))
      throw Error("Status faces must partition the fixed stickers");
    assigned.add(pose.id);
    const sticker = stickers[pose.id],
      body = state.cubies.find((c) => c.id === pose.cubie);
    const assetId = `${id}-${slot}`;
    // Inverse rigid-frame mapping defines print-up; it never advances runtime physics.
    sticker.up = body.orientation.map((basis) => basis[1]);
    sticker.assetId = assetId;
    assetIds.push(assetId);
    documents.push({
      id: assetId,
      text: faceLabel[slot],
      fontId: "status-font",
      color: "#fffdf6",
      background,
      width: 256,
      height: 256,
      fontSize: 144,
      minFontSize: 144,
      lineHeight: 144,
    });
    images.push({
      id: assetId,
      kind: "text",
      documentId: assetId,
      crop: [0, 0, 256, 256],
    });
  });
  statuses.push({ id, label, faceLabel, setup, assetIds });
}
if (assigned.size !== 24)
  throw Error(
    "All 24 source stickers must have exactly one permanent assignment",
  );
const ids = statuses.map((s) => s.id);
const events = [
  { id: "reset", label: "Reset workflow", from: ids, to: "idle" },
  {
    id: "task.queued",
    label: "Task queued",
    from: ["idle", "done", "review"],
    to: "planning",
  },
  { id: "plan.ready", label: "Plan ready", from: ["planning"], to: "coding" },
  {
    id: "tests.started",
    label: "Tests started",
    from: ["coding"],
    to: "testing",
  },
  {
    id: "review.requested",
    label: "Review requested",
    from: ["coding", "testing"],
    to: "review",
  },
  {
    id: "task.completed",
    label: "Task completed",
    from: ["testing", "review"],
    to: "done",
  },
  {
    id: "agent.failed",
    label: "Agent reported failure",
    from: ids,
    to: "review",
    fault: "Simulated agent failure. Review is requested.",
  },
];
const font = "public/fonts/noto-sans-latin-800.woff2";
const definition = {
  schema: "cubistry.status-application",
  version: 1,
  id: "agent-workflow",
  initial: "idle",
  print: validatePrint({ ...source, stickers }),
  assets: {
    schema: "cubistry.assets",
    version: 1,
    fonts: [
      {
        id: "status-font",
        url: "/fonts/noto-sans-latin-800.woff2",
        sha256: createHash("sha256").update(readFileSync(font)).digest("hex"),
        family: "Noto Sans",
        weight: 800,
        format: "woff2",
        license: "SIL-OFL-1.1",
      },
    ],
    materials: [
      { id: "sticker", color: "#ffffff", roughness: 0.7 },
      { id: "plastic", color: "#202329", roughness: 0.45 },
    ],
    documents,
    images,
  },
  statuses,
  events,
  demonstration: [
    "reset",
    "task.queued",
    "plan.ready",
    "tests.started",
    "review.requested",
    "task.completed",
  ],
  artwork: {
    fontPackage: "@fontsource/noto-sans@5.2.10",
    licensePath: "public/fonts/OFL.txt",
    construction:
      "Each source face carries four fixed glyph tiles. Setup words use only existing legal outer turns; paired opposite turns physically reorient the entire cube.",
  },
};
writeFileSync(
  "src/apps/status/definition.json",
  JSON.stringify(definition, null, 2) + "\n",
);
