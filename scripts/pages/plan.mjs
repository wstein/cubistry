import { writeFile, appendFile } from "node:fs/promises";
import { GitHub } from "./api.mjs";
import { plan, BUILD_WORKFLOW, hasPreviewLabel } from "./policy.mjs";
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
if (tree && (tree.truncated || !Array.isArray(tree.tree)))
  throw Error("Incomplete storage-tree inventory");
const inventory = [
  ...new Set(
    (tree?.tree || []).flatMap((x) => {
      const m = /^pr-preview\/pr-([1-9][0-9]*)\//.exec(x.path);
      return m ? [Number(m[1])] : [];
    }),
  ),
];
const builds = {};
for (const pr of pulls)
  if (pr.head?.repo?.full_name === "wstein/cubistry" && hasPreviewLabel(pr))
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
