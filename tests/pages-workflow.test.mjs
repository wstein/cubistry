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
    /group: \$\{\{ vars\.PAGES_PREVIEWS_ENABLED == 'true' && 'counter-pages-publish' \|\| format\('disabled-pages-preview-\{0\}', github\.run_id\) \}\}/,
  );
  assert.match(builder, /concurrency:\n  group: pages-build-/);
  assert.match(
    builder,
    /  deploy:\n    if: github.ref == 'refs\/heads\/main' && vars.PAGES_PREVIEWS_ENABLED != 'true'/,
  );
  assert.match(builder, /    concurrency:\n      group: counter-pages-publish/);
  assert.match(
    builder,
    /cancel-in-progress: \$\{\{ github\.event_name == 'pull_request' \}\}/,
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
