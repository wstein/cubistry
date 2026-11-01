/** Trusted publication policy. Artifacts never decide repository, PR, SHA or paths. */
export const REPOSITORY = "wstein/cubistry";
export const BUILD_WORKFLOW = ".github/workflows/pages.yml";
export const ARTIFACT_NAME = "pages-site";
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
      pr.base?.repo?.full_name !== REPOSITORY
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
/**
 * PR numbers whose preview directory holds real content. The Pages deploy
 * action's rsync protects `.nojekyll`, so a removed preview leaves exactly that
 * empty blob behind; it must not count as an existing preview.
 */
export function previewInventory(tree) {
  if (tree && (tree.truncated || !Array.isArray(tree.tree)))
    throw Error("Incomplete storage-tree inventory");
  const found = new Set();
  for (const x of tree?.tree || []) {
    const m = /^pr-preview\/pr-([1-9][0-9]*)\/(.+)$/.exec(x.path);
    if (m && m[2] !== ".nojekyll") found.add(Number(m[1]));
  }
  return [...found];
}
/** True when a contents-API directory listing holds anything but `.nojekyll`. */
export const hasPreviewContent = (listing) =>
  Boolean(listing) &&
  (!Array.isArray(listing) || listing.some((x) => x?.name !== ".nojekyll"));
