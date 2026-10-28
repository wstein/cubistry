import { GitHub } from "./api.mjs";
import { REPOSITORY, previewPath, selectBuild } from "./policy.mjs";
const api = new GitHub(),
  marker = "<!-- cubistry-pr-preview -->",
  deployOK = process.env.DEPLOY_OK === "true";
const pulls = await api.pages("pulls?state=all");
for (const pr of pulls) {
  if (pr.head?.repo?.full_name !== REPOSITORY) continue;
  const comments = await api.pages(`issues/${pr.number}/comments`);
  const existing = comments.find(
    (c) => c.user?.login === "github-actions[bot]" && c.body?.includes(marker),
  );
  if (pr.state !== "open" && !existing) continue;
  let text;
  if (pr.state !== "open") {
    const remaining = await api.request(
      `contents/${previewPath(pr.number)}?ref=gh-pages`,
    );
    text =
      deployOK && !remaining
        ? "Preview removed after this PR closed or merged."
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
