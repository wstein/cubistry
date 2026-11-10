import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
test("inactive publisher cannot coalesce away a pending legacy production deployment", () => {
  const publisher = readFileSync(
    new URL("../.github/workflows/pages-publish.yml", import.meta.url),
    "utf8",
  );
  const builder = readFileSync(
    new URL("../.github/workflows/pages.yml", import.meta.url),
    "utf8",
  );
  assert.match(
    publisher,
    /group: \$\{\{ vars\.PAGES_PREVIEWS_ENABLED == 'true' && github\.event_name != 'pull_request_target' && github\.ref == 'refs\/heads\/main' && \(github\.event_name != 'workflow_run' \|\| contains\(fromJSON\('\["success","failure"\]'\), github\.event\.workflow_run\.conclusion\)\) && 'counter-pages-publish' \|\| format\('inactive-or-signal-pages-\{0\}', github\.run_id\) \}\}/,
  );
  assert.doesNotMatch(builder.split("jobs:\n")[0], /\nconcurrency:/);
  assert.match(builder, /    concurrency:\n      group: pages-build-/);
  assert.match(
    builder,
    /  deploy:\n    if: github.ref == 'refs\/heads\/main' && vars.PAGES_PREVIEWS_ENABLED != 'true'/,
  );
  assert.match(builder, /    concurrency:\n      group: counter-pages-publish/);
  assert.match(
    builder,
    /cancel-in-progress: \$\{\{ \(github\.event_name == 'pull_request' && \(github\.event\.action != 'labeled' \|\| github\.event\.label\.name == 'preview'\)\) \|\| \(github\.event_name == 'push' && github\.ref == 'refs\/heads\/main'\) \}\}/,
  );
  const groups = new Map();
  const submit = (id, group) => {
    const g = groups.get(group) || { active: null, pending: null };
    if (!g.active) g.active = id;
    else g.pending = id;
    groups.set(group, g);
  };
  submit("legacy-A", "counter-pages-publish");
  submit("legacy-B", "counter-pages-publish");
  submit("disabled-C", "disabled-pages-preview-123");
  assert.deepEqual(groups.get("counter-pages-publish"), {
    active: "legacy-A",
    pending: "legacy-B",
  });
  submit("enabled-C", "counter-pages-publish");
  assert.equal(groups.get("counter-pages-publish").pending, "enabled-C");
  // Symmetric case: with previews enabled, the legacy build's workflow group
  // is separate and its gated-off deploy job never enters publication concurrency.
  const active = new Map([
    [
      "counter-pages-publish",
      { active: "publisher-A", pending: "publisher-B" },
    ],
  ]);
  active.set("pages-build-refs/heads/main", {
    active: "legacy-build-C",
    pending: null,
  });
  const legacyDeployEnabled = false;
  if (legacyDeployEnabled)
    active.get("counter-pages-publish").pending = "legacy-C";
  assert.equal(active.get("counter-pages-publish").pending, "publisher-B");
  // Enabled C's full-state reconciliation handles coalesced updates/cleanup.
});

test("preview smoke's default config passes its resolved port to the static server", async () => {
  const { execFileSync } = await import("node:child_process");
  const env = { ...process.env };
  delete env.PLAYWRIGHT_PORT;
  const output = execFileSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      "import c from './playwright.preview.config.mjs'; console.log(JSON.stringify({url:c.webServer.url,command:c.webServer.command}));",
    ],
    { env, encoding: "utf8" },
  );
  const config = JSON.parse(output);
  assert.equal(config.url, "http://127.0.0.1:5199/cubistry/");
  assert.match(config.command, /PLAYWRIGHT_PORT=5199 STATIC_ROOT=/);
});

test("stacked-PR closure signals fixed main context without PR execution or a dispatch loop", async () => {
  const { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync } =
    await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { execFileSync } = await import("node:child_process");
  const workflow = readFileSync(
    new URL("../.github/workflows/pages-publish.yml", import.meta.url),
    "utf8",
  );
  const signal = workflow.split("  closed-signal:\n")[1].split("  plan:\n")[0];
  assert.match(signal, /github.event_name == 'pull_request_target'/);
  assert.match(signal, /permissions:\n      actions: write/);
  assert.doesNotMatch(
    signal,
    /uses:|contents: write|pages:|id-token:|artifact/,
  );
  assert.match(
    workflow,
    /if: vars.PAGES_PREVIEWS_ENABLED == 'true' && github.event_name != 'pull_request_target' && github.ref == 'refs\/heads\/main'/,
  );
  const run = signal
    .match(/        run: \|\n((?:          .*\n)+)/)[1]
    .split("\n")
    .map((x) => x.slice(10))
    .join("\n")
    .trim();
  assert.equal(
    run,
    "gh api --method POST repos/wstein/cubistry/actions/workflows/pages-publish.yml/dispatches -f ref=main",
  );
  const dir = mkdtempSync(join(tmpdir(), "pages-dispatch-"));
  try {
    mkdirSync(join(dir, "bin"));
    writeFileSync(
      join(dir, "bin/gh"),
      '#!/bin/sh\nprintf "%s\\n" "$@" > "$DISPATCH_ARGS"\n',
      { mode: 0o755 },
    );
    const env = {
      ...process.env,
      PATH: join(dir, "bin") + ":" + process.env.PATH,
      GH_TOKEN: "unit-test-only",
      DISPATCH_ARGS: join(dir, "args"),
      GITHUB_REF: "refs/heads/stacked-feature",
      GITHUB_EVENT_NAME: "pull_request_target",
    };
    execFileSync("bash", ["-e", "-c", run], { env });
    assert.deepEqual(
      readFileSync(join(dir, "args"), "utf8").trim().split("\n"),
      [
        "api",
        "--method",
        "POST",
        "repos/wstein/cubistry/actions/workflows/pages-publish.yml/dispatches",
        "-f",
        "ref=main",
      ],
    );
    writeFileSync(join(dir, "bin/gh"), "#!/bin/sh\nexit 1\n", { mode: 0o755 });
    assert.throws(() => execFileSync("bash", ["-e", "-c", run], { env }));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test("pull request builds start only for the preview label and other labels cannot cancel them", () => {
  const builder = readFileSync(
    new URL("../.github/workflows/pages.yml", import.meta.url),
    "utf8",
  );
  const condition = builder
    .split("  build:\n")[1]
    .match(/    if: >-\n((?:      .*\n)+)/)[1]
    .replace(/\s+/g, " ")
    .trim();
  assert.match(condition, /contains\(github\.event\.pull_request\.labels\.\*\.name, 'preview'\)/);
  assert.match(condition, /github\.event\.action != 'labeled' \|\| github\.event\.label\.name == 'preview'/);
  assert.match(condition, /^github\.ref == 'refs\/heads\/main' \|\|/);
});
test("only completed successful or failed builds reach the publisher's group and plan job", () => {
  const publisher = readFileSync(
    new URL("../.github/workflows/pages-publish.yml", import.meta.url),
    "utf8",
  );
  const guard =
    "(github.event_name != 'workflow_run' || contains(fromJSON('[\"success\",\"failure\"]'), github.event.workflow_run.conclusion))";
  const group = publisher.match(/^  group: (.*)$/m)[1];
  const plan = publisher.split("  plan:\n")[1].match(/^    if: (.*)$/m)[1];
  assert.ok(group.includes(guard));
  assert.ok(plan.includes(guard));
  // The guard must come before the shared publication group name.
  assert.ok(group.indexOf(guard) < group.indexOf("'counter-pages-publish'"));
  // The signal job keeps its own condition and gains no workflow_run handling.
  const signal = publisher.split("  closed-signal:\n")[1].split("  plan:\n")[0];
  assert.doesNotMatch(signal, /workflow_run/);
  // The trigger comment must not claim that such builds start no reconcile run:
  // workflow_run cannot filter by conclusion, so the run starts and only its jobs skip.
  const comment = publisher.split("  workflow_run:")[0];
  assert.match(comment, /still starts a run/);
  assert.doesNotMatch(comment, /does not reach|start(s)? no/);
});

test("only the read-only Pages build supersedes older main heads", () => {
  const builder = readFileSync(new URL("../.github/workflows/pages.yml", import.meta.url), "utf8");
  const build = builder.split("  build:\n")[1].split("  deploy:\n")[0];
  const deploy = builder.split("  deploy:\n")[1];
  const expression = build.match(/^      cancel-in-progress: \$\{\{ (.*) \}\}$/m)[1];
  const cancel = github => Function("github", `return (${expression});`)(github);
  const event = (name, action, label) => ({event_name:name,ref:"refs/heads/main",event:{action,label:{name:label}}});
  assert.equal(cancel(event("push")),true);
  assert.equal(cancel(event("workflow_dispatch")),false);
  assert.equal(cancel(event("pull_request","labeled","preview")),true);
  assert.equal(cancel(event("pull_request","labeled","e2e")),false);
  assert.match(deploy,/group: counter-pages-publish\n      cancel-in-progress: false/);
  assert.doesNotMatch(builder.split("jobs:\n")[0],/\nconcurrency:/);
});

// Expected pins. A new or changed pin in these workflows must update this table (release name verified by a human against the upstream tag).
const PINS = new Map([
  ["actions/checkout", ["3d3c42e5aac5ba805825da76410c181273ba90b1", "v7.0.1"]],
  ["actions/setup-node", ["949feb2413d6458794dcd2491c4babbbce0c15c1", "v7.1.0"]],
  ["actions/setup-python", ["6d4fd22b20465ccc0f7354476588e8df7c9ca0e0", "v7.1.0"]],
  ["actions/upload-artifact", ["cf430e030ddbb5b0abf93d22962f4752f3646cd9", "v7.0.2"]],
  ["actions/upload-pages-artifact", ["fc324d3547104276b827a68afc52ff2a11cc49c9", "v5.0.0"]],
  ["actions/deploy-pages", ["368f82528645a54fb793d4d04e342629a3f51346", "v5.0.1"]],
]);
test("every external action in the Pages build and Counter workflows matches the expected SHA and release pin", () => {
  for (const name of ["pages.yml", "counter.yml", "counter-browser.yml"]) {
    const source = readFileSync(new URL(`../.github/workflows/${name}`, import.meta.url), "utf8");
    const uses = [...source.matchAll(/^\s*(?:- )?uses: (?!\.\/)(\S+)(.*)$/gm)];
    assert.ok(uses.length > 0, name);
    for (const [, ref, rest] of uses) {
      const [action, sha] = ref.split("@");
      const expected = PINS.get(action);
      assert.ok(expected, `${name}: ${action} is not in the expected pin table`);
      assert.equal(sha, expected[0], `${name}: ${action} SHA differs from the expected pin`);
      assert.equal(rest, ` # ${expected[1]}`, `${name}: ${action} release comment differs from ${expected[1]}`);
    }
  }
});

test("Pages build concurrency never lets a manual or push run supersede another event on the same ref", () => {
  const builder = readFileSync(new URL("../.github/workflows/pages.yml", import.meta.url), "utf8");
  const expression = builder.match(/^ {6}group: (pages-build-.*)$/m);
  assert.ok(expression, "the build job has its own concurrency group");
  const group = (event_name, ref, number = null) => expression[1].replace(/\$\{\{ (.*?) \}\}/g, (_, expr) =>
    Function("github", `return (${expr});`)({ event_name, ref, event: { pull_request: { number } } }));
  const main = "refs/heads/main";
  assert.notEqual(group("push", main), group("workflow_dispatch", main));
  assert.notEqual(group("push", main), group("schedule", main));
  assert.notEqual(group("pull_request", main, 7), group("pull_request", main, 8));
  assert.equal(group("push", main), group("push", main));
});
