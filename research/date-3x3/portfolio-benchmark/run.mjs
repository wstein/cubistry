/** Consecutive physical calendar benchmark. Never resets a pose between requests. */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import os from "node:os";
const root = dirname(fileURLToPath(import.meta.url));
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const need = (ok, why) => {
  if (!ok) throw Error(why);
};
const args = {};
for (let i = 2; i < process.argv.length; i += 2) {
  need(
    process.argv[i]?.startsWith("--") && process.argv[i + 1] !== undefined,
    "Supply --name value pairs",
  );
  args[process.argv[i].slice(2)] = process.argv[i + 1];
}
const allowed = new Set([
  "app-root",
  "output",
  "days",
  "domain",
  "interruption-groups",
  "max-ms",
  "provider",
  "provider-name",
  "provider-options",
  "baseline-provider",
  "baseline-options",
  "providers",
]);
need(
  Object.keys(args).every((k) => allowed.has(k)),
  "Unknown benchmark option",
);
need(
  args["app-root"] && args.output,
  "Required: --app-root PATH --output NEW.json",
);
const appRoot = resolve(args["app-root"]),
  output = resolve(args.output),
  days = Number(args.days ?? 366),
  groups = Number(args["interruption-groups"] ?? 20),
  maxMs = Number(args["max-ms"] ?? 600000);
need(Number.isInteger(days) && days >= 1 && days <= 366, "days must be 1..366");
need(
  Number.isInteger(groups) && groups >= 1 && groups <= 100,
  "interruption-groups must be 1..100",
);
need(
  Number.isInteger(maxMs) && maxMs >= 1000 && maxMs <= 7200000,
  "max-ms must be 1,000..7,200,000",
);
const domain = args.domain ?? "calendar";
need(["calendar", "regressions"].includes(domain), "domain must be calendar or regressions");
const regressionStarts = {"nov3": "2026-11-03", "nov2": "2026-11-02", "oct29": "2026-10-29"};
const regressionLengths = {"nov3": 1, "nov2": 2, "oct29": 2};
const scenarios = domain === "calendar" ? ["year", "jumps", "interrupt-move", "interrupt-planning"] : Object.keys(regressionStarts);
const providerOptions = args["provider-options"]
  ? JSON.parse(args["provider-options"])
  : {};
need(
  providerOptions &&
    typeof providerOptions === "object" &&
    !Array.isArray(providerOptions),
  "provider-options must be a JSON object",
);
const selected = (args.providers ?? "baseline-center").split(",");
need(
  selected.length &&
    new Set(selected).size === selected.length &&
    selected.every((x) => ["legacy", "baseline-center"].includes(x)),
  "providers must select legacy and/or baseline-center",
);
if (args.provider) {
  const name = args["provider-name"] ?? "center-aware";
  need(
    /^[a-z][a-z0-9-]+$/.test(name) && !selected.includes(name),
    "Invalid provider name",
  );
  selected.push(name);
} else need(!args["provider-name"], "provider-name requires provider");
for (const suffix of ["", ".manifest.json", ".summary.csv", ".summary.md"])
  need(
    !existsSync(output + suffix),
    "Refusing to overwrite evidence: " + output + suffix,
  );
mkdirSync(dirname(output), { recursive: true });
const cubingRoot = join(appRoot, "node_modules/cubing"),
  cubingPackage = JSON.parse(readFileSync(join(cubingRoot, "package.json")));
const cubingImport = (name) =>
  import(
    pathToFileURL(
      resolve(cubingRoot, cubingPackage.exports["./" + name].import),
    )
  );
const model = await import(
  pathToFileURL(join(appRoot, "src/apps/calendar/model.ts"))
);
const { CalendarController } = await import(
  pathToFileURL(join(appRoot, "src/apps/calendar/controller.ts"))
);
const { createTransitionOptimizer, count } = await import(
  pathToFileURL(join(appRoot, "src/apps/calendar/transition/planner.mjs"))
);
const { KPattern } = await cubingImport("kpuzzle"),
  { puzzles } = await cubingImport("puzzles"),
  { experimentalSolve3x3x3IgnoringCenters: solve } =
    await cubingImport("search");
const baselineExternal = args["baseline-provider"]
  ? await import(pathToFileURL(resolve(args["baseline-provider"])))
  : null;
if (baselineExternal)
  need(
    typeof baselineExternal.createPlanner === "function" &&
      selected.includes("baseline-center"),
    "baseline-provider requires selected baseline-center and createPlanner",
  );
const external = args.provider
  ? await import(pathToFileURL(resolve(args.provider)))
  : null;
if (external)
  need(
    typeof external.createPlanner === "function",
    "External provider must export createPlanner",
  );
const baselineOptions = args["baseline-options"] ? JSON.parse(args["baseline-options"]) : {};
need(baselineOptions && typeof baselineOptions === "object" && !Array.isArray(baselineOptions), "baseline-options must be object");
const externalOptions = { ...(external?.options ?? {}), ...providerOptions };
const kpuzzle = await puzzles["3x3x3"].kpuzzle();
const corrections = JSON.parse(
  readFileSync(
    join(appRoot, "src/apps/calendar/transition/center-corrections.json"),
  ),
).witnesses;
const stamp = (s) =>
  hash(JSON.stringify(s.map((t) => [t.id, t.cubie, t.p, t.n, t.up, t.image])));
const sourceFiles = [
  ...execFileSync("git", ["ls-files", "src/apps/calendar"], {
    cwd: appRoot,
    encoding: "utf8",
  })
    .trim()
    .split("\n")
    .filter(Boolean),
  "package-lock.json",
];
const pinned = Object.fromEntries(
  sourceFiles.map((p) => [p, hash(readFileSync(join(appRoot, p)))]),
);
const appHead = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: appRoot,
  encoding: "utf8",
}).trim();
const appDirty = Boolean(
  execFileSync("git", ["status", "--porcelain", "--untracked-files=no"], {
    cwd: appRoot,
    encoding: "utf8",
  }).trim(),
);
const specs = ["de-a", "en-3-zero", "en-3-unpadded"];
const jumps = [
  "2024-02-29",
  "2024-03-01",
  "2024-12-31",
  "2025-01-01",
  "2000-02-29",
  "1900-03-01",
  "2100-03-01",
  "9999-12-31",
  "0001-01-01",
  "2026-10-28",
  "2026-10-29",
  "2026-10-30",
  "2026-01-01",
  "2025-12-31",
];
const traces = [],
  series = [],
  manifest = {
    schema: "cubistry.calendar-consecutive-benchmark-manifest",
    version: 1,
    scriptSHA256: hash(readFileSync(fileURLToPath(import.meta.url))),
    researchBase: execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: root,
      encoding: "utf8",
    }).trim(),
    appHead,
    appTrackedFilesDirty: appDirty,
    sourceHashes: pinned,
    baselineProvider: args["baseline-provider"]
      ? {
          moduleSHA256: hash(readFileSync(resolve(args["baseline-provider"]))),
          metadata: baselineExternal.metadata ?? null,
          options: baselineOptions,
        }
      : null,
    externalProvider: args.provider
      ? {
          moduleSHA256: hash(readFileSync(resolve(args.provider))),
          metadata: external.metadata ?? null,
        }
      : null,
    parameters: {
      days,
      domain,
      interruptionGroups: groups,
      maxMs,
      providers: selected,
      direct: { maxAttempts: 6, timeBudgetMs: 500 },
      externalOptions,
      baselineOptions,
    },
    machine: {
      cpuQuota: existsSync("/sys/fs/cgroup/cpu.max")
        ? readFileSync("/sys/fs/cgroup/cpu.max", "utf8").trim()
        : null,
      memoryLimit: existsSync("/sys/fs/cgroup/memory.max")
        ? readFileSync("/sys/fs/cgroup/memory.max", "utf8").trim()
        : null,
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      cpu: os.cpus()[0]?.model,
      cpuCount: os.availableParallelism(),
      totalMemoryBytes: os.totalmem(),
    },
    sources: [],
    timingScope:
      "Node controller request through committed full target; no browser/render/network timing; provider construction separately measured",
    solver:
      "cubing@" +
      JSON.parse(
        readFileSync(join(appRoot, "node_modules/cubing/package.json")),
      ).version,
    seed: "No configurable cubing solver seed; actual returned words retained",
  };
const begun = performance.now();
let complete = true,
  stopReason = null,
  caseSerial = 0;
const keepAlive = setInterval(() => {}, 1000);
class StopBudget extends Error {}
const budget = () => {
  if (performance.now() - begun >= maxMs)
    throw new StopBudget("Benchmark maximum elapsed time reached");
};
async function waitIdle(controller) {
  const start = performance.now();
  while (controller.busy) {
    if (performance.now() - start > 60000)
      throw Error("Controller did not settle within 60 seconds");
    await new Promise((r) => setTimeout(r, 1));
  }
}
function source(design, date) {
  return model.findTarget(design, model.civilDate(date));
}
async function runSeries(provider, id, scenario) {
  budget();
  const bytes = readFileSync(join(appRoot, "public/calendar", id + ".json")),
    design = model.validateDesign(JSON.parse(bytes));
  const initialISO = regressionStarts[scenario] ?? (scenario === "year" ? "2024-01-01" : "2024-02-28"),
    initial = source(design, initialISO),
    rows = [];
  let pose,
    controller,
    currentISO = initialISO,
    capture = null,
    trigger = null,
    latestContext = null,
    failure = null,
    reference = initial.word;
  const startup = performance.now();
  let plan;
  if (provider === "legacy") plan = async (context) => context.fallbackWord;
  else if (provider === "baseline-center" && baselineExternal)
    plan = await baselineExternal.createPlanner({
      design,
      appRoot,
      options: baselineOptions,
    });
  else if (provider === "baseline-center") {
    const optimizer = createTransitionOptimizer({
      printing: design.printing,
      kpuzzle,
      KPattern,
      solve,
      corrections,
    });
    plan = async (context) => {
      const result = await optimizer.plan(
        context.from,
        context.target,
        context.fallbackWord,
        { maxAttempts: 6, timeBudgetMs: 500 },
      );
      plan.lastDiagnostics = {
        method: result.method,
        attempts: result.attempts,
        budgetExceeded: result.budgetExceeded,
        error: result.error,
        candidates: result.candidates,
      };
      return result.word;
    };
  } else
    plan = await external.createPlanner({
      design,
      appRoot,
      options: externalOptions,
    });
  need(
    typeof plan === "function",
    "Provider did not return a planner function",
  );
  const startupMs = performance.now() - startup;
  const wrapped = async (context) => {
    latestContext = context;
    const measurement = {
      target: [
        context.target.weekday,
        context.target.day,
        context.target.month,
      ],
      sourceReferenceTokens: model.tokens(context.sourceWord).length,
      baselineCounts: count(context.fallbackWord),
    };
    if (context.sourceWord !== reference) {
      measurement.sourceReferenceReplacement = context.sourceWord;
      reference = context.sourceWord;
    }
    measurement.sourceReferenceHash = hash(context.sourceWord);
    if (capture) capture.planning.push(measurement);
    const at = performance.now();
    try {
      const pending = plan(context);
      if (trigger?.kind === "planning") {
        const hook = trigger;
        trigger = null;
        measurement.superseded = true;
        for (const iso of hook.queued) controller.request(source(design, iso));
      }
      const word = await pending;
      measurement.elapsedMs = performance.now() - at;
      measurement.returnedCounts = count(word);
      measurement.diagnostics = plan.lastDiagnostics ?? plan.lastResult ?? null;
      return word;
    } catch (error) {
      measurement.elapsedMs = performance.now() - at;
      if (
        measurement.superseded &&
        /supersed|cancel|abort/i.test(error.message)
      )
        measurement.providerCanceled = error.message;
      else measurement.providerError = error.message;
      throw error;
    }
  };
  for (const name of ["compactReference", "cancel", "cancelPlanning"])
    if (typeof plan[name] === "function")
      wrapped[name] = (...values) => plan[name](...values);
  controller = new CalendarController(
    design,
    initial,
    {
      configure(_design, state) {
        pose = state;
      },
      async animate(from, token, to) {
        need(model.sameState(pose, from), "Discontinuous actual move source");
        need(
          model.sameState(model.apply(from, token), to),
          "Incorrect physical move destination",
        );
        if (capture) {
          if (
            typeof controller.sourceReferenceWord === "string" &&
            controller.sourceReferenceWord !== reference
          ) {
            capture.referenceEvents.push({
              beforeMove: capture.moves.length,
              word: controller.sourceReferenceWord,
              wordHash: hash(controller.sourceReferenceWord),
            });
            reference = controller.sourceReferenceWord;
          }
          capture.moves.push(token);
          capture.moveTargets.push([
            controller.progress.target.weekday,
            controller.progress.target.day,
            controller.progress.target.month,
          ]);
          if (capture.firstMotionMs === null)
            capture.firstMotionMs = performance.now() - capture.started;
        }
        if (trigger?.kind === "move") {
          const hook = trigger;
          trigger = null;
          for (const iso of hook.queued)
            controller.request(source(design, iso));
        }
        pose = to;
        reference = model.simplify(reference + " " + token);
      },
    },
    (_target, _busy, error) => {
      if (error) failure = error;
    },
    wrapped,
  );
  const item = {
    provider,
    design: id,
    scenario,
    initialISO,
    initialWord: initial.word,
    initialStateHash: stamp(pose),
    startupMs,
    providerMetadata:
      plan.metadata ??
      (provider === "baseline-center"
        ? baselineExternal?.metadata
        : provider === "legacy"
          ? null
          : external?.metadata) ??
      null,
    rowIndexes: [],
  };
  series.push(item);
  async function request(requests, direction = 0, interrupt = null) {
    budget();
    capture = {
      started: performance.now(),
      moves: [],
      referenceEvents: [],
      moveTargets: [],
      planning: [],
      firstMotionMs: null,
    };
    const fromHash = stamp(pose),
      fromISO = currentISO,
      first = requests[0],
      last = requests.at(-1);
    trigger = interrupt ? { kind: interrupt, queued: requests.slice(1) } : null;
    controller.request(source(design, first));
    await waitIdle(controller);
    need(!failure, failure?.message ?? "Physical playback failed");
    need(!trigger, "Interruption hook never ran");
    need(
      model.matches(pose, source(design, last).cells) &&
        model.sameState(pose, controller.physicalState),
      "Final physical target mismatch",
    );
    need(
      controller.current === source(design, last),
      "Incorrect coalesced final target",
    );
    const elapsedMs = performance.now() - capture.started,
      word = capture.moves.join(" "),
      finalKey = [
        controller.current.weekday,
        controller.current.day,
        controller.current.month,
      ];
    const obsoleteCommitted = capture.moveTargets.filter(
      (k) => JSON.stringify(k) !== JSON.stringify(finalKey),
    ).length;
    if (interrupt === "move")
      need(
        obsoleteCommitted === 1,
        "Old route did not stop after its active committed turn",
      );
    if (interrupt === "planning")
      need(obsoleteCommitted === 0, "Stale plan executed a physical turn");
    const record = {
      index: caseSerial++,
      provider,
      design: id,
      scenario,
      direction,
      fromISO,
      requests,
      toISO: last,
      fromStateHash: fromHash,
      toStateHash: stamp(pose),
      word,
      counts: count(word),
      finalPlanCounts: controller.progress.total,
      route: controller.progress.route,
      elapsedMs,
      firstMotionMs: capture.firstMotionMs,
      planning: capture.planning,
      obsoleteCommitted,
      moveTargets: capture.moveTargets,
      referenceEvents: capture.referenceEvents,
    };
    const canonicalTarget = source(design, last);
    if (
      model.sameState(pose, model.sourcePose(design, canonicalTarget)) &&
      model.tokens(canonicalTarget.word).length < model.tokens(reference).length
    )
      reference = canonicalTarget.word;
    if (
      typeof controller.sourceReferenceWord === "string" &&
      controller.sourceReferenceWord !== reference
    ) {
      record.endReferenceReplacement = controller.sourceReferenceWord;
      reference = controller.sourceReferenceWord;
    }
    record.referenceEndTokens = model.tokens(reference).length;
    item.rowIndexes.push(traces.length);
    traces.push(record);
    rows.push(record);

    currentISO = last;
    capture = null;
    latestContext = null;
    if (traces.length % 100 === 0)
      console.error(
        "Committed",
        traces.length,
        "requests;",
        Math.round(performance.now() - begun),
        "ms;",
        provider,
        id,
        scenario,
      );
  }
  try {
    if (scenario in regressionStarts) {
      for (let n = 0; n < regressionLengths[scenario]; n++) await request([scenario === "oct29" && n === 0 ? "2026-11-03" : model.shiftDate(model.civilDate(currentISO), 1).iso], 1);
    } else if (scenario === "year") {
      for (const direction of [1, -1])
        for (let n = 0; n < days; n++) {
          const iso = model.shiftDate(
            model.civilDate(currentISO),
            direction,
          ).iso;
          await request([iso], direction);
        }
    } else if (scenario === "jumps")
      for (const iso of jumps) await request([iso]);
    else
      for (let n = 0; n < groups; n++) {
        const initial = model.civilDate(currentISO),
          plus = (d) => {
            let v = initial;
            for (let i = 0; i < d; i++) v = model.shiftDate(v, 1);
            return v.iso;
          };
        await request(
          [plus(1), plus(2), plus(4), plus(3)],
          1,
          scenario === "interrupt-move" ? "move" : "planning",
        );
      }
  } finally {
    if (typeof plan.dispose === "function") await plan.dispose();
  }
}
try {
  for (const id of specs) {
    const bytes = readFileSync(join(appRoot, "public/calendar", id + ".json")),
      d = JSON.parse(bytes);
    manifest.sources.push({
      id,
      path: "public/calendar/" + id + ".json",
      sha256: hash(bytes),
      printing: d.printing,
    });
  }
  for (const provider of selected)
    for (const id of specs)
      for (const scenario of scenarios)
        await runSeries(provider, id, scenario);
} catch (e) {
  complete = false;
  stopReason = e.message;
  console.error(e.stack);
} finally {
  clearInterval(keepAlive);
}
const quantile = (a, q) =>
  a.length
    ? a.toSorted((x, y) => x - y)[
        Math.min(a.length - 1, Math.ceil(a.length * q) - 1)
      ]
    : null;
const measure = (a) => ({
  mean: a.length ? a.reduce((x, y) => x + y, 0) / a.length : null,
  median: quantile(a, 0.5),
  p95: quantile(a, 0.95),
  maximum: a.length ? Math.max(...a) : null,
  total: a.reduce((x, y) => x + y, 0),
});
const statistics = series.flatMap((s) =>
  [...(s.scenario === "year" ? [1, -1] : [0])].map((direction) => {
    const rows = s.rowIndexes
      .map((i) => traces[i])
      .filter((r) => s.scenario !== "year" || r.direction === direction);
    return {
      provider: s.provider,
      design: s.design,
      scenario: s.scenario,
      direction,
      cases: rows.length,
      htm: measure(rows.map((r) => r.counts.htm)),
      qtm: measure(rows.map((r) => r.counts.qtm)),
      rotations: measure(rows.map((r) => r.counts.global)),
      allMoves: measure(rows.map((r) => r.counts.total)),
      elapsedMs: measure(rows.map((r) => r.elapsedMs)),
      firstMotionMs: measure(
        rows
          .filter((r) => r.firstMotionMs !== null)
          .map((r) => r.firstMotionMs),
      ),
      noMotionCases: rows.filter((r) => r.firstMotionMs === null).length,
      canceledPlans: rows.reduce(
        (n, r) =>
          n + r.planning.filter((p) => Boolean(p.providerCanceled)).length,
        0,
      ),
      providerErrors: rows.reduce(
        (n, r) =>
          n +
          r.planning.filter((p) => p.providerError || p.diagnostics?.error)
            .length,
        0,
      ),
      fallbackCases: rows.filter((r) => r.route === "fallback").length,
      fallbackRate: rows.length
        ? rows.filter((r) => r.route === "fallback").length / rows.length
        : null,
      maximumSourceReferenceTokens: rows.reduce(
        (n, r) =>
          Math.max(n, ...r.planning.map((p) => p.sourceReferenceTokens)),
        0,
      ),
      worstCases: rows
        .toSorted((a, b) => b.counts.total - a.counts.total)
        .slice(0, 5)
        .map((r) => ({
          index: r.index,
          fromISO: r.fromISO,
          toISO: r.toISO,
          counts: r.counts,
          elapsedMs: r.elapsedMs,
          route: r.route,
        })),
    };
  }),
);
const report = {
  schema: "cubistry.calendar-consecutive-benchmark",
  version: 1,
  status: "UNKNOWN; independent replay pending",
  complete,
  stopReason,
  elapsedMs: performance.now() - begun,
  expectedCases: selected.length * 3 * (domain === "calendar" ? days * 2 + jumps.length + groups * 2 : 5),
  manifest,
  series,
  statistics,
  cases: traces,
};
writeFileSync(output, JSON.stringify(report) + "\n", { flag: "wx" });
writeFileSync(
  output + ".manifest.json",
  JSON.stringify(
    {
      ...manifest,
      reportSHA256: hash(readFileSync(output)),
      complete,
      actualCases: traces.length,
      expectedCases: report.expectedCases,
    },
    null,
    2,
  ) + "\n",
  { flag: "wx" },
);
const header = [
  "provider",
  "design",
  "scenario",
  "direction",
  "cases",
  "meanHTM",
  "maxHTM",
  "meanQTM",
  "maxQTM",
  "meanXYZ",
  "meanPlanningToCommitMs",
  "p95PlanningToCommitMs",
  "maxPlanningToCommitMs",
  "fallbackRate",
  "maximumSourceReferenceTokens",
];
writeFileSync(
  output + ".summary.csv",
  [
    header.join(","),
    ...statistics.map((s) =>
      [
        s.provider,
        s.design,
        s.scenario,
        s.direction,
        s.cases,
        s.htm.mean,
        s.htm.maximum,
        s.qtm.mean,
        s.qtm.maximum,
        s.rotations.mean,
        s.elapsedMs.mean,
        s.elapsedMs.p95,
        s.elapsedMs.maximum,
        s.fallbackRate,
        s.maximumSourceReferenceTokens,
      ].join(","),
    ),
  ].join("\n") + "\n",
  { flag: "wx" },
);
writeFileSync(
  output + ".summary.md",
  "# Consecutive calendar measurements\n\nEvidence status: " +
    report.status +
    ". Complete: " +
    complete +
    ".\n\n| Provider | Print | Scenario | Direction | Cases | Mean HTM | Max HTM | Mean elapsed ms | P95 elapsed ms |\n| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: |\n" +
    statistics
      .map(
        (s) =>
          `| ${s.provider} | ${s.design} | ${s.scenario} | ${s.direction} | ${s.cases} | ${s.htm.mean?.toFixed(2)} | ${s.htm.maximum} | ${s.elapsedMs.mean?.toFixed(2)} | ${s.elapsedMs.p95?.toFixed(2)} |`,
      )
      .join("\n") +
    "\n\nNode timings include planning and immediate physical-commit verification, not browser animation. Fallback includes an equally short existing reference, not necessarily solver failure. No universal move bound or optimality is established.\n",
  { flag: "wx" },
);
console.log(
  JSON.stringify(
    {
      output,
      complete,
      cases: traces.length,
      expectedCases: report.expectedCases,
      elapsedMs: report.elapsedMs,
      stopReason,
    },
    null,
    2,
  ),
);
if (!complete) process.exitCode = 2;
