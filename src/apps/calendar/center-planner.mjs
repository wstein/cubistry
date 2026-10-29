import providerPin from "../../../puzlwerk-picture-source.json" with { type: "json" };
import {
  solvePicture3x3,
  centerKernelReference,
} from "@puzlwerk/solver-3x3-picture";
import * as G from "./transition/geometry.mjs";
import {
  apply,
  matches,
  tokens,
  simplify,
  inverse,
  sameState,
} from "./model.ts";
import { createTransitionOptimizer } from "./transition/planner.mjs";
import corrections from "./transition/center-corrections.json" with { type: "json" };
const order = ["U", "L", "F", "R", "B", "D"],
  serialization = ["U", "R", "F", "D", "L", "B"];
const normals = {
  U: [0, 1, 0],
  L: [-1, 0, 0],
  F: [0, 0, 1],
  R: [1, 0, 0],
  B: [0, 0, -1],
  D: [0, -1, 0],
};
const center = (s) => s.p.filter(Boolean).length === 1;
const eq = G.eq;
const need = (ok, reason) => {
  if (!ok) throw Error(reason);
};
const coordinate = (face, row, col) =>
  ({
    U: [col - 1, 1, row - 1],
    D: [col - 1, -1, 1 - row],
    F: [col - 1, 1 - row, 1],
    B: [1 - col, 1 - row, -1],
    R: [1, 1 - row, 1 - col],
    L: [-1, 1 - row, col - 1],
  })[face];
const rotations = new Map();
function alignments(printing) {
  const identity = JSON.stringify(
    printing.filter(center).map((s) => [s.id, s.p]),
  );
  if (rotations.has(identity)) return rotations.get(identity);
  const queue = [{ state: printing.filter(center), word: "" }],
    seen = new Set();
  for (let i = 0; i < queue.length; i++) {
    const row = queue[i],
      key = JSON.stringify(row.state.map((s) => s.p));
    if (seen.has(key)) continue;
    seen.add(key);
    for (const move of ["x", "x'", "x2", "y", "y'", "y2", "z", "z'", "z2"]) {
      const state = apply(row.state, move),
        next = JSON.stringify(state.map((s) => s.p));
      if (!seen.has(next))
        queue.push({ state, word: [row.word, move].filter(Boolean).join(" ") });
    }
  }
  const unique = [];
  const keys = new Set();
  for (const row of queue) {
    const key = JSON.stringify(row.state.map((s) => s.p));
    if (!keys.has(key)) {
      keys.add(key);
      unique.push(row.word);
    }
  }
  need(unique.length === 24, "Expected the 24 rigid whole-cube frames");
  rotations.set(identity, unique);
  return unique;
}
/** The canonical target defines ephemeral solver colors; printed images never change. */
export function pictureRequest(context) {
  const { design, from, target } = context,
    goal = apply(design.printing, target.word);
  need(matches(goal, target.cells), "Invalid canonical picture target");
  const word = alignments(design.printing).find((word) =>
    apply(from.filter(center), word).every((s) =>
      eq(s.p, goal.find((g) => g.id === s.id)?.p ?? []),
    ),
  );
  need(word !== undefined, "Center positions do not share a rigid frame");
  const aligned = apply(from, word),
    colors = new Map(
      goal.map((s) => [
        s.id,
        serialization.find((face) => eq(normals[face], s.n)),
      ]),
    );
  need(
    aligned.length === 54 && colors.size === 54,
    "Expected 54 immutable source faces",
  );
  const facelets = serialization
    .flatMap((face) =>
      Array.from({ length: 9 }, (_, i) => {
        const candidates = aligned.filter(
          (s) =>
            eq(s.n, normals[face]) &&
            eq(s.p, coordinate(face, Math.floor(i / 3), i % 3)),
        );
        need(candidates.length === 1, "Invalid physical facelet occupancy");
        return colors.get(candidates[0].id);
      }),
    )
    .join("");
  const centerOrientations = order.map((face) => {
    const source = goal.find((s) => center(s) && eq(s.n, normals[face])),
      actual = aligned.find((s) => s.id === source?.id);
    need(source && actual, "Missing physical center identity");
    const amount = [0, 1, 2, 3].find((k) =>
      eq(
        apply([source], k ? face + (k === 2 ? "2" : k === 3 ? "'" : "") : "")[0]
          .up,
        actual.up,
      ),
    );
    need(amount !== undefined, "Invalid center orientation frame");
    return amount;
  });
  return {
    alignment: word,
    aligned,
    goal,
    facelets,
    centerOrientations,
    symmetry: order.map((face) => (face === "F" && target.cells[4] ? 4 : 1)),
  };
}
export function referencesForPlan(context, word) {
  const end = apply(context.from, word),
    request = pictureRequest({ ...context, from: end });
  need(
    request.alignment === "",
    "Reference endpoint changed its canonical center frame",
  );
  need(
    request.goal
      .filter((s) => !center(s))
      .every((s) => {
        const t = end.find((t) => t.id === s.id);
        return t && eq(s.p, t.p) && eq(s.n, t.n) && eq(s.up, t.up);
      }),
    "Reference endpoint has noncanonical hidden cubies",
  );
  const kernel = centerKernelReference(request.centerOrientations);
  need(kernel.status === "reference", "Invalid relative center kernel");
  const endReferenceWord = simplify(
    context.target.word + " " + kernel.moves.join(" "),
  );
  need(
    sameState(apply(context.design.printing, endReferenceWord), end),
    "Exact endpoint reference mismatch",
  );
  const fromReferenceWord = simplify(endReferenceWord + " " + inverse(word));
  need(
    sameState(apply(context.design.printing, fromReferenceWord), context.from),
    "Exact source reference mismatch",
  );
  return {
    fromReferenceWord,
    endReferenceWord,
    maximumKernelMoves: kernel.maximumReferenceMoves,
  };
}
const total = (word) => tokens(word).length;
/** The existing checked direct route remains the upper bound and failure path. */
export function tryCenterAware(context, directWord, options = {}) {
  const { maximumNodes = 100000, maximumDepth = 24, threshold = 14 } = options;
  need(
    Number.isInteger(threshold) && threshold >= 0 && threshold <= 1000,
    "Invalid center threshold",
  );
  if (total(directWord) <= threshold)
    return { word: directWord, method: "direct", attempted: false };
  const started = performance.now();
  try {
    const request = pictureRequest(context),
      depth = Math.min(
        maximumDepth,
        total(directWord) - tokens(request.alignment).length - 1,
      );
    const result = solvePicture3x3({
      ...request,
      maximumDepth: depth,
      maximumNodes,
    });
    if (result.status !== "solved")
      return {
        word: directWord,
        method: "direct",
        attempted: true,
        status: result.status,
        reason: result.reason,
        elapsedMs: performance.now() - started,
      };
    const candidate = simplify(
      request.alignment + " " + result.moves.join(" "),
    );
    need(
      matches(apply(context.from, candidate), context.target.cells),
      "Center-aware route missed its physical front",
    );
    return total(candidate) < total(directWord)
      ? {
          word: candidate,
          method: "center-aware",
          attempted: true,
          status: "solved",
          elapsedMs: performance.now() - started,
        }
      : {
          word: directWord,
          method: "direct",
          attempted: true,
          status: "not-shorter",
          elapsedMs: performance.now() - started,
        };
  } catch (error) {
    return {
      word: directWord,
      method: "direct",
      attempted: true,
      status: "error",
      reason: error.message,
      elapsedMs: performance.now() - started,
    };
  }
}
/** Two bounded attempts: retain the default result, then search a shorter cap.
 * Node and browser callers share the policy and its physical candidate checker.
 */
export function tryCenterPortfolio(
  context,
  directWord,
  options = {},
  onCandidate,
) {
  const started = performance.now();
  const maximumNodes = options.maximumNodes ?? 100000;
  const attempts = [];
  let improvementSkippedReason;
  let best = tryCenterAware(context, directWord, options);
  let alignmentMoves;
  try {
    alignmentMoves = total(pictureRequest(context).alignment);
  } catch {}
  const record = (result, requestedDepth, upperBound) => {
    const maximumDepth =
      alignmentMoves === undefined
        ? null
        : Math.min(requestedDepth, total(upperBound) - alignmentMoves - 1);
    attempts.push({
      maximumNodes,
      maximumDepth,
      status: result.status ?? "not-attempted",
      attempted: result.attempted,
      moves: total(result.word),
      word: result.word,
      outerHTM: tokens(result.word).filter((t) => /^[ULFRBD]/.test(t)).length,
      rotations: tokens(result.word).filter((t) => /^[xyz]/.test(t)).length,
      elapsedMs: result.elapsedMs ?? 0,
      reason: result.reason,
    });
  };
  record(best, options.maximumDepth ?? 24, directWord);
  if (best.attempted) onCandidate?.({ ...best, attempts: [...attempts] });
  if (best.attempted) {
    try {
      const rotations = total(pictureRequest(context).alignment);
      const depth = Math.min(
        options.maximumDepth ?? 24,
        18,
        total(best.word) - rotations - 1,
      );
      if (depth >= 0 && depth < attempts[0].maximumDepth) {
        const candidate = tryCenterAware(context, best.word, {
          ...options,
          threshold: 0,
          maximumDepth: depth,
        });
        record(candidate, depth, best.word);
        if (total(candidate.word) < total(best.word)) best = candidate;
      } else {
        improvementSkippedReason = "native-depth-not-strictly-smaller";
      }
    } catch (error) {
      attempts.push({
        attempted: false,
        status: "error",
        reason: error.message,
      });
    }
  }
  return {
    ...best,
    elapsedMs: performance.now() - started,
    attempts,
    maximumAttempts: 2,
    maximumTotalNodes: maximumNodes * 2,
    improvementSkippedReason,
  };
}
/** Node benchmark entry point. Browsers call the same candidate checker in a worker. */
export async function createPlanner({ design, options = {} }) {
  const [
    { KPattern },
    { puzzles },
    { experimentalSolve3x3x3IgnoringCenters: solve },
  ] = await Promise.all([
    import("cubing/kpuzzle"),
    import("cubing/puzzles"),
    import("cubing/search"),
  ]);
  const direct = createTransitionOptimizer({
    printing: design.printing,
    kpuzzle: await puzzles["3x3x3"].kpuzzle(),
    KPattern,
    solve,
    corrections: corrections.witnesses,
  });
  const references = new Map();
  const maximumAttempts =
    options.backend === "direct" ? 0 : options.policy === "default" ? 1 : 2;
  let generation = 0;
  const planner = async (context) => {
    const started = performance.now(),
      activeGeneration = generation;
    const baseline = await direct.plan(
      context.from,
      context.target,
      context.fallbackWord,
      { maxAttempts: 6, timeBudgetMs: 500 },
    );
    if (activeGeneration !== generation)
      throw Error("Calendar planning superseded");
    planner.lastResult =
      options.backend === "direct"
        ? { word: baseline.word, method: "direct", attempted: false }
        : options.policy === "default"
          ? tryCenterAware(context, baseline.word, options)
          : tryCenterPortfolio(context, baseline.word, options);
    planner.lastDiagnostics = {
      backendUsed:
        planner.lastResult.method === "center-aware"
          ? "center-aware"
          : baseline.optimized
            ? "direct"
            : "legacy",
      attempted: planner.lastResult.attempted,
      solverStatus: planner.lastResult.status ?? "not-attempted",
      directMoves: total(baseline.word),
      chosenMoves: total(planner.lastResult.word),
      maximumNodes: options.maximumNodes ?? 100000,
      maximumTotalNodes: (options.maximumNodes ?? 100000) * maximumAttempts,
      maximumAttempts,
      attempts: planner.lastResult.attempts ?? [],
      improvementSkippedReason: planner.lastResult.improvementSkippedReason,
      maximumDepth: options.maximumDepth ?? 24,
      centerElapsedMs: planner.lastResult.elapsedMs ?? 0,
      planningElapsedMs: performance.now() - started,
      reason: planner.lastResult.reason,
    };
    try {
      const refs = referencesForPlan(context, planner.lastResult.word);
      references.set(context.target, {
        from: context.from,
        end: apply(context.from, planner.lastResult.word),
        ...refs,
      });
      while (references.size > 4)
        references.delete(references.keys().next().value);
      planner.lastDiagnostics.referenceFromMoves = total(
        refs.fromReferenceWord,
      );
      planner.lastDiagnostics.referenceEndMoves = total(refs.endReferenceWord);
    } catch (error) {
      planner.lastDiagnostics.referenceError = error.message;
    }
    return planner.lastResult.word;
  };
  planner.cancelPlanning = () => {
    generation++;
  };
  planner.compactReference = ({ state, target, referenceWord }) => {
    const ref = references.get(target);
    return ref && sameState(ref.from, state)
      ? ref.fromReferenceWord
      : ref && sameState(ref.end, state)
        ? ref.endReferenceWord
        : referenceWord;
  };
  planner.metadata = {
    providerPin,
    backend: options.backend ?? "center-aware",
    policy:
      options.backend === "direct"
        ? "direct-v1"
        : options.policy === "default"
          ? "default-v1"
          : "default-then-shorter-cap18-v2",
    maximumAttempts,
    maximumTotalNodes: (options.maximumNodes ?? 100000) * maximumAttempts,
    package: "@puzlwerk/solver-3x3-picture@0.1.0",
    upstream: "08e079f3bc211777d8980f75ec6a7f61979dd2ac",
    maximumNodes: options.maximumNodes ?? 100000,
    maximumDepth: options.maximumDepth ?? 24,
    threshold: options.threshold ?? 14,
  };
  return planner;
}
