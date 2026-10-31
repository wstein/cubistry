import {
  demand,
  deepFreeze,
  record,
  validatePrint,
  stateEquals,
  type CubeState,
  type LegalMove,
  type PrintDefinition,
} from "@cubistry/cube-core";
import {
  initialState,
  applyMoves,
  parseAlg,
  matchesTarget,
} from "@cubistry/cube-mechanics";
import { deploymentBasePath, sha256 } from "@cubistry/cube-assets";
import { targetFor, type CounterDesign } from "./design.ts";
import { inverseMoves, type CertifiedCounter } from "./certified.ts";

/** The two counting modes of the blank-top print (same permanent stickers). */
export type BlankTopMode = "lz" | "nz";
export interface BlankTopCounter {
  readonly print: PrintDefinition;
  readonly routes: Readonly<Record<BlankTopMode, CertifiedCounter>>;
  /** LZ 00 to NZ _0; NZ _0 to LZ 00 is its exact inverse. */
  readonly modeSwitch: readonly LegalMove[];
  /** Words from the printed state; the printed state shows 00 (LZ). */
  readonly setups: Readonly<Record<BlankTopMode, readonly LegalMove[]>>;
}
/** Research numbers the runtime must reproduce, per mode. */
export const BLANK_TOP_STATISTICS = deepFreeze({
  lz: { totalHTM: 278, maximumHTM: 4, setupHTM: 0 },
  nz: { totalHTM: 270, maximumHTM: 4, setupHTM: 6 },
  switchHTM: 6,
});
export const modeSwitchMoves = (
  counter: BlankTopCounter,
  to: BlankTopMode,
): readonly LegalMove[] =>
  to === "nz" ? counter.modeSwitch : inverseMoves(counter.modeSwitch);
/**
 * The word that switches to mode `to` at `value`, or null where no switch is
 * offered: the 6-HTM switch word (or its inverse) at 00, and an empty word at
 * every value where both modes store the identical complete state (no turn,
 * no hidden change). Everywhere else, switch at 00.
 */
export function modeSwitchAt(
  counter: BlankTopCounter,
  to: BlankTopMode,
  value: number,
): readonly LegalMove[] | null {
  demand(Number.isInteger(value) && value >= 0 && value <= 99, "Invalid value");
  if (stateEquals(counter.routes.lz.states[value], counter.routes.nz.states[value]))
    return [];
  return value === 0 ? modeSwitchMoves(counter, to) : null;
}

/**
 * Validate the derived runtime against the titled counter's canonical source
 * geometry (cubie IDs, positions, sticker IDs and normals), then replay the
 * setup and every edge of both modes with the shared mechanics: each display,
 * each exact inverse, cycle closure, the totals and the mode switch.
 * This is an application ingress check, not a proof.
 */
export function validateBlankTopCounter(
  raw: unknown,
  design: CounterDesign,
): BlankTopCounter {
  const d = record(raw, "blank-top counter");
  demand(
    d.schema === "cubistry.counter-blank-top" &&
      d.version === 1 &&
      d.puzzle === "2x2x2",
    "Unsupported blank-top counter",
  );
  demand(
    Array.isArray(d.printing) && d.printing.length === 24,
    "Blank-top print requires 24 permanent stickers",
  );
  const base = design.prints.padded;
  const printing = d.printing as Record<string, unknown>[];
  const print = validatePrint({
    ...base,
    id: "counter_blank_top",
    stickers: printing.map((s, i) => {
      const original = base.stickers[i];
      demand(
        s.id === original.id &&
          s.cubie === original.cubie &&
          JSON.stringify(s.n) === JSON.stringify(original.normal),
        "Blank-top sticker identity mismatch",
      );
      const cubie = base.cubies.find((c) => c.id === s.cubie)!;
      demand(
        JSON.stringify(s.p) === JSON.stringify(cubie.position),
        "Blank-top source position mismatch",
      );
      demand(
        typeof s.image === "string" &&
          (s.image === "blank" || /^[0-9]$/.test(s.image)),
        "Invalid blank-top image",
      );
      return {
        ...original,
        normal: s.n,
        up: s.up,
        assetId: s.image,
        equivalentQuarterTurns: s.image === "blank" ? [0, 1, 2, 3] : [0],
      };
    }),
  });
  const images = print.stickers.map((s) => s.assetId);
  demand(
    images.filter((a) => a === "blank").length === 4 &&
      [..."0123456789"].every(
        (digit) => images.filter((a) => a === digit).length === 2,
      ),
    "Blank-top print needs 4 blanks and two stickers per digit",
  );
  demand(Array.isArray(d.modes) && d.modes.length === 2, "Two modes expected");
  const routes = {} as Record<BlankTopMode, CertifiedCounter>;
  const setups = {} as Record<BlankTopMode, readonly LegalMove[]>;
  for (const [index, mode] of (["lz", "nz"] as const).entries()) {
    const m = record((d.modes as unknown[])[index], "blank-top mode");
    const padded = mode === "lz";
    demand(
      m.mode === mode && m.leadingZero === padded,
      "Blank-top mode order changed",
    );
    demand(typeof m.setup === "string", "Invalid blank-top setup");
    const setup = parseAlg(m.setup);
    demand(
      Array.isArray(m.increments) && m.increments.length === 100,
      "Blank-top route needs 100 edges",
    );
    const increments = (m.increments as unknown[]).map((w) => {
      demand(typeof w === "string", "Invalid blank-top word");
      return parseAlg(w);
    });
    const expected = BLANK_TOP_STATISTICS[mode];
    const lengths = increments.map((w) => w.length);
    demand(
      setup.length === expected.setupHTM &&
        m.setupHTM === expected.setupHTM &&
        m.totalHTM === expected.totalHTM &&
        m.maximumHTM === expected.maximumHTM &&
        lengths.reduce((a, b) => a + b, 0) === expected.totalHTM &&
        Math.max(...lengths) === expected.maximumHTM,
      "Invalid blank-top route statistics",
    );
    const states: CubeState[] = [applyMoves(initialState(print), setup)];
    for (let value = 0; value < 100; value++) {
      demand(
        matchesTarget(print, states[value], targetFor(value, padded, "blank-top")),
        "Incorrect blank-top display",
      );
      const next = applyMoves(states[value], increments[value]);
      demand(
        stateEquals(applyMoves(next, inverseMoves(increments[value])), states[value]),
        "Blank-top inverse mismatch",
      );
      if (value < 99) states.push(next);
      else demand(stateEquals(next, states[0]), "Blank-top cycle does not close");
    }
    routes[mode] = { print, states, increments, variant: "blank-top", padded, cyclic: true };
    setups[mode] = setup;
  }
  demand(
    stateEquals(initialState(print), routes.lz.states[0]),
    "The printed state must be LZ 00",
  );
  const s = record(d.modeSwitch, "blank-top mode switch");
  demand(
    s.from === "lz" &&
      s.to === "nz" &&
      s.value === 0 &&
      typeof s.word === "string" &&
      s.htm === BLANK_TOP_STATISTICS.switchHTM,
    "Invalid blank-top mode switch",
  );
  const modeSwitch = parseAlg(s.word);
  demand(
    modeSwitch.length === BLANK_TOP_STATISTICS.switchHTM &&
      stateEquals(applyMoves(routes.lz.states[0], modeSwitch), routes.nz.states[0]) &&
      stateEquals(
        applyMoves(routes.nz.states[0], inverseMoves(modeSwitch)),
        routes.lz.states[0],
      ),
    "Blank-top mode switch does not connect LZ 00 and NZ _0",
  );
  return deepFreeze({ print, routes, modeSwitch, setups });
}

/** Fetch the derived runtime and check its pinned SHA-256 before parsing it. */
export async function loadBlankTopCounter(
  design: CounterDesign,
  expectedSHA256: string,
  basePath = "/",
): Promise<BlankTopCounter> {
  demand(/^[0-9a-f]{64}$/.test(expectedSHA256), "Missing blank-top runtime pin");
  const response = await fetch(
    `${deploymentBasePath(basePath)}counter-blank-top.v1.json`,
    { signal: AbortSignal.timeout(10000), redirect: "error", credentials: "same-origin" },
  );
  demand(response.ok, "Blank-top print could not be loaded");
  demand(
    (response.headers.get("content-type") || "").split(";")[0] === "application/json",
    "Unexpected blank-top content type",
  );
  const reader = response.body?.getReader();
  demand(reader, "Missing blank-top response body");
  const parts: Uint8Array[] = [];
  let length = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > 262144) {
      await reader.cancel();
      throw Error("Blank-top print too large");
    }
    parts.push(value);
  }
  const bytes = new Uint8Array(length);
  let at = 0;
  for (const p of parts) {
    bytes.set(p, at);
    at += p.length;
  }
  demand((await sha256(bytes)) === expectedSHA256, "Blank-top print integrity check failed");
  return validateBlankTopCounter(JSON.parse(new TextDecoder().decode(bytes)), design);
}
