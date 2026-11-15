import * as Codec from "../res/upstream/State/FaceletCodec.res.mjs";
import * as Solver from "../res/upstream/Solver/TwoPhaseSolver.res.mjs";
import * as Centers from "../res/upstream/Solver/PictureCenters.res.mjs";
import * as Executor from "../res/upstream/Move/MoveExecutor.res.mjs";

export const PICTURE_SOLVER_API_VERSION = 1;
const result = (status, reason) =>
  Object.freeze({ version: 1, status, reason });
/** Synchronous bounded engine. Callers own a worker's hard deadline/cancellation. */
export function solvePicture3x3(request) {
  if (!request || typeof request !== "object")
    return result("invalid", "Expected a picture request");
  const {
    facelets,
    centerOrientations,
    symmetry = [4, 4, 4, 4, 4, 4],
    maximumDepth = 22,
    maximumNodes = 100000,
  } = request;
  if (typeof facelets !== "string" || !/^[URFDLB]{54}$/.test(facelets))
    return result("invalid", "Expected exactly 54 URFDLB facelets");
  if (
    !Array.isArray(centerOrientations) ||
    !Centers.validOrientations(centerOrientations) ||
    !Array.isArray(symmetry) ||
    !Centers.validSymmetry(symmetry)
  )
    return result(
      "invalid",
      "Expected six center orientations 0..3 and six symmetry periods 1, 2 or 4 in ULFRBD order",
    );
  if (
    !Number.isInteger(maximumDepth) ||
    maximumDepth < 0 ||
    maximumDepth > 24 ||
    !Number.isInteger(maximumNodes) ||
    maximumNodes < 1 ||
    maximumNodes > 10000000
  )
    return result("invalid", "Depth must be 0..24; node budget 1..10000000");
  const parsed = Codec.parse(3, facelets);
  if (parsed.TAG !== "Ok")
    return result("invalid", "Invalid ordinary cube facelets");
  const centers = [...centerOrientations],
    periods = [...symmetry];
  const solved = Solver.solvePictureAtDepth(
    parsed._0,
    centers,
    periods,
    maximumDepth,
    maximumNodes,
  );
  if (solved.TAG !== "Ok") {
    const status = [
      "SearchFailed",
      "SearchBudgetExceeded",
      "VerificationFailed",
    ].includes(solved._0)
      ? "unknown"
      : "invalid";
    return result(status, Solver.describeError(solved._0));
  }
  const expanded = Executor.expand(solved._0.alg);
  if (expanded.TAG !== "Ok")
    throw Error("Picture solver returned an invalid algorithm");
  const moves = expanded._0.map(({ move, turns }) => {
    if (
      move.TAG !== "FaceTurn" ||
      move._1.from_ !== 1 ||
      move._1.to_ !== 1 ||
      ![-1, 1, 2].includes(turns)
    )
      throw Error("Picture solver returned a non-outer move");
    return move._0 + (turns === 2 ? "2" : turns === -1 ? "'" : "");
  });
  const after = Centers.apply(centers, solved._0.alg);
  if (
    after.TAG !== "Ok" ||
    Centers.distance(Centers.encode(after._0), periods) !== 0 ||
    moves.length > maximumDepth
  )
    throw Error("Picture goal verification failed");
  return Object.freeze({
    version: 1,
    status: "solved",
    moves: Object.freeze(moves),
    htm: moves.length,
    qtm: moves.reduce((n, t) => n + (t.endsWith("2") ? 2 : 1), 0),
    centerOrientationsAfter: Object.freeze([...after._0]),
  });
}

export {
  centerKernelReference,
  centerKernelReferenceStatistics,
} from "./center-reference.mjs";
