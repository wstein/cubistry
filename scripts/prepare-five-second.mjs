// Materialize only integrity-pinned evidence; canonical proofs remain on Research.
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  mkdtempSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
const root = fileURLToPath(new URL("../", import.meta.url));
const source = JSON.parse(
  readFileSync(join(root, "five-second-source.json"), "utf8"),
);
if (
  source.repository !== "https://github.com/wstein/cubistry.git" ||
  !/^[0-9a-f]{40}$/.test(source.commit) ||
  source.runtime !== "research/five-second-timer/optimized-runtime.json"
)
  throw Error("Invalid five-second Research pin");
const entries = Object.entries(source.sha256);
if (
  !entries.length ||
  entries.some(
    ([name, hash]) =>
      !/^research\/(five-second-timer|timer-2x2)(\/[a-z0-9_.-]+)+$/.test(
        name,
      ) || !/^[0-9a-f]{64}$/.test(hash),
  )
)
  throw Error("Invalid evidence paths or hashes");
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const cache = join(root, ".five-second-research");
const valid = (path, hash) =>
  existsSync(path) && digest(readFileSync(path)) === hash;
if (entries.some(([name, hash]) => !valid(join(cache, name), hash))) {
  const temporary = mkdtempSync(join(tmpdir(), "cubistry-five-second-"));
  try {
    const run = (args) =>
      execFileSync("git", args, {
        cwd: temporary,
        stdio: ["ignore", "pipe", "inherit"],
        maxBuffer: 4 * 1024 * 1024,
      });
    run(["init", "--quiet"]);
    run(["fetch", "--depth=1", source.repository, source.commit]);
    if (run(["rev-parse", "FETCH_HEAD"]).toString().trim() !== source.commit)
      throw Error("Research commit mismatch");
    const files = entries.map(([name, hash]) => {
      const bytes = run(["show", `${source.commit}:${name}`]);
      if (digest(bytes) !== hash)
        throw Error(`Research integrity mismatch: ${name}`);
      return [name, bytes];
    });
    for (const [name, bytes] of files) {
      const path = join(cache, name);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, bytes);
    }
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}
const bytes = readFileSync(join(cache, source.runtime));
if (digest(bytes) !== source.sha256[source.runtime])
  throw Error("Runtime integrity mismatch");
const output = join(root, "public/five-second-timer.v1.json");
if (!valid(output, source.sha256[source.runtime])) writeFileSync(output, bytes);
console.log(`Verified five-second Research ${source.commit.slice(0, 12)}`);
