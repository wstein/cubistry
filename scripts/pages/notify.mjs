// SPDX-License-Identifier: AGPL-3.0-or-later
import { GitHub } from "./api.mjs";
import {
  REPOSITORY,
  previewPath,
  selectBuild,
  hasPreviewLabel,
  hasPreviewContent,
} from "./policy.mjs";
import {loadNotification,currentNotification} from "./notification.mjs";
export async function notifyPreviews(api,receipt,{fresh=()=>currentNotification(api,receipt)}={}) {
const marker = "<!-- cubistry-pr-preview -->", deployOK=receipt.proof!==null;
for (const number of receipt.numbers) {
  const pr=await api.request(`pulls/${number}`);
  if(!pr)continue;
  if (pr.head?.repo?.full_name !== REPOSITORY) continue;
  const comments = await api.pages(`issues/${pr.number}/comments`);
  const existing = comments.find(
    (c) => c.user?.login === "github-actions[bot]" && c.body?.includes(marker),
  );
  const active = pr.state === "open" && hasPreviewLabel(pr);
  if (!active && !existing) continue;
  let text;
  if (!active) {
    const remaining = await api.request(
      `contents/${previewPath(pr.number)}?ref=gh-pages`,
    );
    text =
      deployOK && !hasPreviewContent(remaining)
        ? pr.state === "open"
          ? "Preview removed because the `preview` label is gone."
          : "Preview removed after this PR closed or merged."
        : "Preview cleanup/deployment is pending or failed; the last deployment may still contain the old preview.";
  } else {
    const runs = await api.pages(
      `actions/workflows/pages.yml/runs?event=pull_request&head_sha=${pr.head.sha}`,
      "workflow_runs",
    );
    const build = selectBuild(runs, pr.head.sha, "pull_request", pr.number);
    const metadata = await api.request(
      `contents/${previewPath(pr.number)}/preview-info.json?ref=gh-pages`,
    );
    let published;
    try {
      published =
        metadata &&
        JSON.parse(Buffer.from(metadata.content, "base64").toString());
    } catch {}
    const url = `https://wstein.github.io/cubistry/${previewPath(pr.number)}/`;
    text =
      build.status === "failed"
        ? `Latest preview build failed for ${pr.head.sha.slice(0, 12)}. Any previous preview is stale.`
        : deployOK && published?.sha === pr.head.sha
          ? `[Open non-production PR preview](${url}) · ${pr.head.sha.slice(0, 12)}. This stable URL updates after successful builds.`
          : `Preview pending or publication/validation failed for ${pr.head.sha.slice(0, 12)}. Any previous preview is stale; no successful latest deployment is claimed.`;
    if (build.run)
      text += `\n\n[Build details](https://github.com/${REPOSITORY}/actions/runs/${build.run}).`;
  }
  const body = `${marker}\n### Cubistry PR preview\n${text}`;
  if (existing?.body === body) continue;
  // Recheck immediately before every write: older reconciliations cannot
  // overwrite a newer publisher, PR head, label state or live snapshot.
  if(!await fresh())return;
  const current=await api.request(`pulls/${pr.number}`);
  if(!current || current.state!==pr.state || current.head?.sha!==pr.head?.sha || hasPreviewLabel(current)!==hasPreviewLabel(pr) || current.head?.repo?.full_name!==REPOSITORY)continue;
  await api.request(
    existing
      ? `issues/comments/${existing.id}`
      : `issues/${pr.number}/comments`,
    {
      method: existing ? "PATCH" : "POST",
      body: JSON.stringify({ body }),
      headers: { "Content-Type": "application/json" },
    },
  );
}

}
if(process.argv[1]?.endsWith("/notify.mjs")){
 const api=new GitHub();
 const receipt=await loadNotification(api,Number(process.env.PUBLISH_RUN));
 await notifyPreviews(api,receipt);
}
