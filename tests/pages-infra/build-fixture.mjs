// Local smoke harness only. No branch/token/API/deployment operation is performed.
import { execFileSync } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
await rm("test-results/preview-site", { recursive: true, force: true });
const build = (base) =>
  execFileSync("npm", ["run", "build"], {
    stdio: "inherit",
    env: { ...process.env, VITE_BASE_PATH: base },
  });
const pack = () =>
  execFileSync(
    "python3",
    [
      "-c",
      "import pathlib,zipfile; z=zipfile.ZipFile('test-results/site.zip','w',zipfile.ZIP_DEFLATED); [z.write(p,str(p.relative_to('dist'))) for p in pathlib.Path('dist').rglob('*') if p.is_file()];z.close()",
    ],
    { stdio: "inherit" },
  );
await mkdir("test-results", { recursive: true });
build("/cubistry/");
pack();
execFileSync("python3", [
  "scripts/pages/extract.py",
  "test-results/site.zip",
  "test-results/preview-site",
]);
for (const number of [52, 53]) {
  build(`/cubistry/pr-preview/pr-${number}/`);
  pack();
  execFileSync("python3", [
    "scripts/pages/extract.py",
    "test-results/site.zip",
    `test-results/preview-site/pr-preview/pr-${number}`,
    String(number),
    "a".repeat(40),
  ]);
}
