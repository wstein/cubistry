/** Trusted publication policy. Artifacts never decide repository, PR, SHA or paths. */
export const REPOSITORY = "wstein/cubistry";
export const BUILD_WORKFLOW = ".github/workflows/pages.yml";
export const ARTIFACT_NAME = "pages-site";
// A PR gets a preview only while it carries this label.
export const PREVIEW_LABEL = "preview";
export const hasPreviewLabel = (pr) =>
  Array.isArray(pr?.labels) && pr.labels.some((l) => l?.name === PREVIEW_LABEL);
export const previewPath = (number) => {
  if (!Number.isSafeInteger(number) || number < 1)
    throw Error("Invalid PR number");
  return `pr-preview/pr-${number}`;
};
export function validRun(run, sha, event, number) {
  return (
    /^[a-f0-9]{40}$/.test(sha) &&
    run.head_sha === sha &&
    (Array.isArray(event) ? event.includes(run.event) : run.event === event) &&
    run.path === BUILD_WORKFLOW &&
    run.repository?.full_name === REPOSITORY &&
    run.head_repository?.full_name === REPOSITORY &&
    (run.event !== "pull_request" ||
      (Number.isSafeInteger(number) &&
        Array.isArray(run.pull_requests) &&
        run.pull_requests.some(
          (pr) =>
            pr.number === number &&
            pr.head?.sha === sha &&
            Number.isSafeInteger(run.repository.id) &&
            pr.head?.repo?.id === run.repository.id &&
            pr.base?.repo?.id === run.repository.id,
        )))
  );
}
export function selectBuild(runs, sha, event, number) {
  const run = runs
    .filter((r) => validRun(r, sha, event, number))
    .sort((a, b) => b.id - a.id)[0];
  if (!run) return { status: "pending" };
  if (run.status !== "completed") return { status: "pending", run: run.id };
  if (run.conclusion !== "success") return { status: "failed", run: run.id };
  return { status: "success", run: run.id };
}
export function plan({ pulls, inventory, builds, main }) {
  const entries = [],
    eligible = new Set();
  for (const pr of pulls) {
    if (
      pr.state !== "open" ||
      pr.head?.repo?.full_name !== REPOSITORY ||
      pr.base?.repo?.full_name !== REPOSITORY ||
      !hasPreviewLabel(pr)
    )
      continue;
    previewPath(pr.number);
    eligible.add(pr.number);
    const build = selectBuild(
      builds[pr.number] || [],
      pr.head.sha,
      "pull_request",
      pr.number,
    );
    entries.push({
      number: pr.number,
      sha: pr.head.sha,
      ...build,
      action: build.status === "success" ? "deploy" : "none",
    });
  }
  for (const number of inventory)
    if (!eligible.has(number))
      entries.push({ number, action: "remove", status: "closed" });
  if (entries.length > 200)
    throw Error("Too many previews for one bounded reconciliation");
  return {
    entries,
    production: {
      sha: main.sha,
      ...selectBuild(
        main.runs.filter((r) => r.head_branch === "main"),
        main.sha,
        ["push", "workflow_dispatch"],
      ),
    },
  };
}
