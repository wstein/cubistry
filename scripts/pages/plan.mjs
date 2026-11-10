// SPDX-License-Identifier: AGPL-3.0-or-later
import { writeFile, appendFile } from "node:fs/promises";
import { GitHub } from "./api.mjs";
import { plan, previewInventory, BUILD_WORKFLOW, hasPreviewLabel } from "./policy.mjs";
import { readVerifiedPublication } from './publication.mjs';
import { optimizePlan, notificationNumbers, retainNotificationCandidates, commentMarker } from './reconciliation.mjs';
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
// git/trees/<branch> reports the commit sha; the tree sha is on the commit.
const remoteTree = (await api.request("commits/gh-pages"))?.commit?.tree?.sha;
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
let result = plan({
  pulls,
  inventory,
  builds,
  main: { sha: main.sha, runs },
});
const published=await readVerifiedPublication(api);
const production=await metadata('.cubistry-production.json');
const previews={};
for(const entry of result.entries)if(entry.action==='deploy')previews[entry.number]=await metadata(`pr-preview/pr-${entry.number}/preview-info.json`);
// Migrate old stable comments once. Later receipts retain only relevant PRs,
// so normal reconciliation never scans the entire historical PR collection.
const bootstrap=[];
if(!published){
  for(const pr of await api.pages('pulls?state=all')){
    if(pr.head?.repo?.full_name!=='wstein/cubistry')continue;
    const comments=await api.pages(`issues/${pr.number}/comments`);
    if(comments.some(c=>c.user?.login==='github-actions[bot]'&&c.body?.includes(commentMarker)))bootstrap.push(pr.number);
  }
}
result.notify=notificationNumbers({pulls,inventory,published,bootstrap});
result.tracked=await retainNotificationCandidates(api,{numbers:result.notify,pulls,inventory,published});
result=optimizePlan(result,{storage:remoteTree,published,production,previews,tracked:result.tracked});
async function metadata(path){
  const blob=await api.request(`contents/${path}?ref=gh-pages`);
  try{return blob?.content?JSON.parse(Buffer.from(blob.content,'base64').toString()):null;}catch{return null;}
}
await writeFile("pages-plan.json", JSON.stringify(result));
// A sentinel keeps the matrix structurally valid when no previews exist.
await appendFile(
  process.env.GITHUB_OUTPUT,
  `matrix=${JSON.stringify({ include: result.entries.filter(x=>x.action!=='none').length ? result.entries.filter(x=>x.action!=='none') : [{ number: 0, action: "none", status: "empty" }] })}\nproduction=${JSON.stringify({ number: 0, ...result.production })}\nearly=${result.early}\npreviews=${result.previews}\nnotify=${JSON.stringify(result.notify)}\ntracked=${JSON.stringify(result.tracked)}\n`,
);
