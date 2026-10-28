import { TEN_SECOND_TIMER, FIVE_SECOND_TIMER, type TimerProfile } from "./clock.ts";
import {
  demand,
  deepFreeze,
  record,
  validatePrint,
  stateEquals,
  type PrintDefinition,
  type CubeState,
  type LegalMove,
  type DisplayTarget,
  type Vec3,
} from "@cubistry/cube-core";
import {
  initialState,
  applyMoves,
  parseAlg,
  matchesTarget,
} from "@cubistry/cube-mechanics";
import { deploymentBasePath, sha256 } from "@cubistry/cube-assets";
export interface TimerRoute {
  readonly profile: TimerProfile;
  readonly print: PrintDefinition;
  readonly states: readonly CubeState[];
  readonly increments: readonly (readonly LegalMove[])[];
}
const FRONT: readonly Vec3[] = [
  [-1, 1, 1],
  [1, 1, 1],
  [-1, -1, 1],
  [1, -1, 1],
];
export function timerTarget(bucket: number, profile: TimerProfile = TEN_SECOND_TIMER): DisplayTarget {
  demand(
    Number.isInteger(bucket) && bucket >= 0 && bucket <= profile.maxSeconds / profile.stepSeconds,
    "Invalid timer target",
  );
  const seconds = bucket * profile.stepSeconds;
  const digits =
    String(Math.floor(seconds / 60)).padStart(2, "0") +
    String(seconds % 60).padStart(2, "0");
  return deepFreeze({
    schema: "cubistry.target",
    version: 1,
    facelets: FRONT.map((position, i) => ({
      position,
      normal: [0, 0, 1] as Vec3,
      up: [0, 1, 0] as Vec3,
      assetId: digits[i],
      matching: "exact" as const,
    })),
  });
}
export function inverseTimerMoves(
  moves: readonly LegalMove[],
): readonly LegalMove[] {
  return [...moves].reverse().map((m) => ({
    face: m.face,
    turns: m.turns === 2 ? 2 : m.turns === 1 ? -1 : 1,
  }));
}
export function validateTimerRoute(raw: unknown): TimerRoute {
  return validateRoute(raw, false);
}
export function validateFiveSecondRoute(raw: unknown): TimerRoute {
  return validateRoute(raw, true);
}
function validateRoute(raw: unknown, five: boolean): TimerRoute {
  const profile = five ? FIVE_SECOND_TIMER : TEN_SECOND_TIMER;
  const edges = profile.maxSeconds / profile.stepSeconds;
  const totalHTM = five ? 2237 : 1324, maximumHTM = five ? 6 : 5;
  const d = record(raw, "workshop timer");
  demand(
    d.schema === (five ? "cubistry.five-second-timer" : "cubistry.workshop-timer") &&
      d.version === 1 &&
      d.puzzle === "2x2x2" &&
      d.stepSeconds === profile.stepSeconds &&
      d.maxSeconds === profile.maxSeconds,
    "Unsupported workshop timer",
  );
  demand(
    Array.isArray(d.printing) && d.printing.length === 24,
    "Timer needs 24 immutable stickers",
  );
  const printing = d.printing as Record<string, unknown>[];
  const cubies = Array.from({ length: 8 }, (_, id) => {
    const s = printing.find((s) => s.cubie === id);
    demand(s, "Missing timer cubie");
    return { id, position: s.p };
  });
  const print = validatePrint({
    schema: "cubistry.print",
    version: 1,
    id: five ? "five_second_timer_39m55" : "workshop_timer_59m50",
    topology: { kind: "cube", size: 2 },
    cubies,
    stickers: printing.map((s, i) => {
      demand(
        s.id === i && typeof s.image === "string" && /^[0-9]$/.test(s.image),
        "Invalid timer sticker",
      );
      demand(
        JSON.stringify(s.p) ===
          JSON.stringify(cubies.find((c) => c.id === s.cubie)?.position),
        "Timer source position mismatch",
      );
      return {
        id: s.id,
        cubie: s.cubie,
        normal: s.n,
        up: s.up,
        assetId: s.image,
        materialId: "sticker",
        equivalentQuarterTurns: [0],
      };
    }),
  });
  demand(
    typeof d.zeroWord === "string" && parseAlg(d.zeroWord).length === (five ? 6 : 5),
    "Invalid timer zero setup",
  );
  demand(
    Array.isArray(d.increments) && d.increments.length === edges,
    "Incorrect timer edge count",
  );
  const increments = (d.increments as unknown[]).map((w) => {
    demand(typeof w === "string", "Invalid timer word");
    return parseAlg(w);
  });
  demand(
    d.totalHTM === totalHTM &&
      d.maximumHTM === maximumHTM &&
      increments.reduce((n, w) => n + w.length, 0) === totalHTM &&
      Math.max(...increments.map((w) => w.length)) === maximumHTM,
    "Incorrect timer certificate statistics",
  );
  const states = [applyMoves(initialState(print), parseAlg(d.zeroWord))];
  demand(matchesTarget(print, states[0], timerTarget(0, profile)), "Invalid timer zero");
  for (let i = 0; i < edges; i++) {
    const next = applyMoves(states[i], increments[i]);
    demand(
      matchesTarget(print, next, timerTarget(i + 1, profile)),
      "Invalid timer display",
    );
    demand(
      stateEquals(
        applyMoves(next, inverseTimerMoves(increments[i])),
        states[i],
      ),
      "Invalid timer inverse",
    );
    states.push(next);
  }
  return deepFreeze({ profile, print, states, increments });
}
export function timerStep(
  route: TimerRoute,
  from: CubeState,
  current: number,
  target: number,
): readonly LegalMove[] | null {
  if (
    Math.abs(target - current) !== 1 ||
    !stateEquals(from, route.states[current])
  )
    return null;
  return target > current
    ? route.increments[current]
    : inverseTimerMoves(route.increments[target]);
}
export async function loadTimerRoute(basePath = "/"): Promise<TimerRoute> {
  return loadRoute(basePath, false);
}
export async function loadFiveSecondRoute(basePath = "/"): Promise<TimerRoute> {
  return loadRoute(basePath, true);
}
async function loadRoute(basePath: string, five: boolean): Promise<TimerRoute> {
  const response = await fetch(
    `${deploymentBasePath(basePath)}${five ? "five-second-timer" : "workshop-timer"}.v1.json`,
    {
      signal: AbortSignal.timeout(10000),
      redirect: "error",
      credentials: "same-origin",
    },
  );
  demand(response.ok, "Timer certificate could not be loaded");
  demand(
    (response.headers.get("content-type") || "").split(";")[0] ===
      "application/json",
    "Unexpected timer content type",
  );
  const reader = response.body?.getReader();
  demand(reader, "Missing timer certificate body");
  const parts: Uint8Array[] = [];
  let length = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > 262144) {
      await reader.cancel();
      throw Error("Timer certificate too large");
    }
    parts.push(value);
  }
  const bytes = new Uint8Array(length);
  let at = 0;
  for (const p of parts) {
    bytes.set(p, at);
    at += p.length;
  }
  demand(
    (await sha256(bytes)) ===
      (five ? "fe46391d03877698633d87b5874763362f0c626ef83cade74d7c32656e990865" : "7dbc7ba98d93a71c084feada89a2f2d24de98aa03034fda0649c0af5f3463790"),
    "Timer certificate integrity check failed",
  );
  return (five ? validateFiveSecondRoute : validateTimerRoute)(JSON.parse(new TextDecoder().decode(bytes)));
}
