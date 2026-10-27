// Materialize one pinned provider dependency, never vendor its source into Git.
import {
  mkdtempSync,
  readFileSync,
  mkdirSync,
  copyFileSync,
  rmSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
// Git, ReScript and npm must create the same archive modes on every runner.
// This affects only this bootstrap process and its temporary provider build.
process.umask(0o022);
const root = fileURLToPath(new URL("../", import.meta.url));
const source = JSON.parse(
  readFileSync(join(root, "puzlwerk-source.json"), "utf8"),
);
if (
  source.repository !== "https://github.com/wstein/puzlwerk.git" ||
  !/^[a-f0-9]{40}$/.test(source.commit) ||
  source.package !== "@puzlwerk/solver-2x2"
)
  throw new Error("Unsupported provider source pin");
const output = join(root, ".puzlwerk-dependency", "solver-2x2.tgz");
const integrity = (bytes) =>
  "sha512-" + createHash("sha512").update(bytes).digest("base64");
const expected = source.integrity;
if (!/^sha512-[A-Za-z0-9+/]{86}==$/.test(expected ?? ""))
  throw new Error("Provider artifact integrity pin is required");
if (
  !process.argv.includes("--rebuild") &&
  existsSync(output) &&
  integrity(readFileSync(output)) === expected
) {
  console.log("Pinned PuzlWerk dependency already verified");
} else {
  const temporary = mkdtempSync(join(tmpdir(), "cubistry-provider-"));
  const run = (cmd, args, capture = false) =>
    execFileSync(cmd, args, {
      cwd: temporary,
      stdio: capture ? ["ignore", "pipe", "inherit"] : "inherit",
      encoding: "utf8",
    });
  try {
    run("git", ["init", "--quiet"]);
    run("git", ["fetch", "--depth=1", source.repository, source.commit]);
    run("git", ["checkout", "--quiet", "--detach", "FETCH_HEAD"]);
    if (run("git", ["rev-parse", "HEAD"], true).trim() !== source.commit)
      throw new Error("Provider commit mismatch");
    run("npm", ["ci", "--include=dev", "--no-audit", "--no-fund"]);
    run("npm", ["run", "build"]);
    const packed = JSON.parse(
      run(
        "npm",
        [
          "pack",
          "--workspace",
          source.package,
          "--pack-destination",
          temporary,
          "--json",
        ],
        true,
      ),
    )[0];
    if (
      packed.version !== source.version ||
      packed.name !== source.package
    )
      throw new Error("Provider package metadata mismatch");
    const bytes = readFileSync(join(temporary, packed.filename));
    const actual = integrity(bytes);
    if (actual !== expected)
      throw new Error(
        `Rebuilt provider artifact differs from the pinned integrity: ${actual}`,
      );
    mkdirSync(join(root, ".puzlwerk-dependency"), { recursive: true });
    copyFileSync(join(temporary, packed.filename), output);
    console.log(
      JSON.stringify({
        providerCommit: source.commit,
        package: packed.name,
        integrity: actual,
      }),
    );
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}
