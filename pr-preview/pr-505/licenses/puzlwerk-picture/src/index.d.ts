export type FaceMove = `${"U" | "R" | "F" | "D" | "L" | "B"}${"" | "2" | "'"}`;
export interface PictureRequest {
  /** Row-major facelets in URFDLB order, canonical center-color frame. */
  readonly facelets: string;
  /** Clockwise physical quarter turns in ULFRBD order, not inferred from colors. */
  readonly centerOrientations: readonly number[];
  /** Goal periods in ULFRBD order; default all 4. Hidden/free centers use 1. */
  readonly symmetry?: readonly (1 | 2 | 4)[];
  readonly maximumDepth?: number;
  readonly maximumNodes?: number;
}
export type PictureResult = Readonly<
  | {
      version: 1;
      status: "solved";
      moves: readonly FaceMove[];
      htm: number;
      qtm: number;
      centerOrientationsAfter: readonly number[];
    }
  | { version: 1; status: "unknown" | "invalid"; reason: string }
>;
export declare const PICTURE_SOLVER_API_VERSION: 1;
/** Run in a worker; the caller imposes a hard deadline and handles cancellation. */
export declare function solvePicture3x3(request: PictureRequest): PictureResult;
/** Metadata/reference construction only: no shortest-path or executed-route bound. */
export declare function centerKernelReference(
  orientations: readonly number[],
): Readonly<
  | {
      status: "reference";
      moves: readonly FaceMove[];
      htm: number;
      maximumReferenceMoves: number;
    }
  | { status: "invalid"; reason: string }
>;
export declare function centerKernelReferenceStatistics(): Readonly<{
  states: number;
  maximumReferenceMoves: number;
  generators: readonly {
    word: string;
    delta: readonly number[];
    htm: number;
  }[];
}>;
