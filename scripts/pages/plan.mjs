import { writeFile, appendFile } from "node:fs/promises";
import { GitHub } from "./api.mjs";
import { plan, previewInventory, BUILD_WORKFLOW } from "./policy.mjs";
const api = new GitHub();
const pages = await api.request("pages");
if (
  pages?.build_type !== "workflow" ||
  pages.html_url !== "https://wstein.github.io/cubistry/" ||
  pages.cname !== null
)
  throw Error(
    "Pages configuration changed; review deployment strategy before publication",
  );
const pulls = await api.pages("pulls?state=open"),
  main = await api.request("commits/main");
const tree = await api.request("git/trees/gh-pages?recursive=1");
const inventory = previewInventory(tree);
const builds = {};
for (const pr of pulls)
  if (pr.head?.repo?.full_name === "wstein/cubistry")
    builds[pr.number] = await api.pages(
      `actions/workflows/pages.yml/runs?event=pull_request&head_sha=${pr.head.sha}`,
      "workflow_runs",
    );
const runs = await api.pages(
  `actions/workflows/pages.yml/runs?head_sha=${main.sha}`,
  "workflow_runs",
);
const result = plan({
  pulls,
  inventory,
  builds,
  main: { sha: main.sha, runs },
});
await writeFile("pages-plan.json", JSON.stringify(result));
// A sentinel keeps the matrix structurally valid when no previews exist.
await appendFile(
  process.env.GITHUB_OUTPUT,
  `matrix=${JSON.stringify({ include: result.entries.length ? result.entries : [{ number: 0, action: "none", status: "empty" }] })}\nproduction=${JSON.stringify({ number: 0, ...result.production })}\n`,
);
