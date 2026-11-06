import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const workflow = readFileSync(
  new URL("../.github/workflows/docs-quality.yml", import.meta.url),
  "utf8",
);
test("docs-quality concurrency: one group per pull request or ref, only pull requests cancel", () => {
  assert.match(
    workflow,
    /\nconcurrency:\n {2}group: docs-\$\{\{ github\.event\.pull_request\.number \|\| github\.ref \}\}\n {2}cancel-in-progress: \$\{\{ github\.event_name == 'pull_request' \}\}\n/,
  );
});
