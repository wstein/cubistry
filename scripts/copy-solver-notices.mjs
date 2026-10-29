// Keep the dependency's exact attribution/license data with the built preview.
import { mkdirSync, copyFileSync, cpSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { TABLE_URL } from "@puzlwerk/solver-2x2";
const output = process.argv[2]
  ? pathToFileURL(resolve(process.argv[2]) + "/")
  : new URL("../dist/", import.meta.url);
const destination = new URL("licenses/puzlwerk/", output);
mkdirSync(destination, { recursive: true });
for (const file of ["LICENSE", "NOTICE", "COPYING", "provenance.json"])
  copyFileSync(new URL("../" + file, TABLE_URL), new URL(file, destination));
copyFileSync(
  new URL("../puzlwerk-source.json", import.meta.url),
  new URL("source.json", destination),
);

// Preserve cubing and its bundled vendor/optional WASM notices with every build.
cpSync(
  new URL("../third-party/cubing/", import.meta.url),
  new URL("licenses/cubing/", output),
  { recursive: true },
);

// Include the picture provider's complete corresponding source and build metadata.
const pictureRoot = new URL(
  "../",
  import.meta.resolve("@puzlwerk/solver-3x3-picture"),
);
const pictureOutput = new URL("licenses/puzlwerk-picture/", output);
mkdirSync(pictureOutput, { recursive: true });
for (const file of [
  "LICENSE",
  "NOTICE",
  "UPSTREAM-NOTICE",
  "README.md",
  "rescript.json",
  "provenance.json",
])
  copyFileSync(new URL(file, pictureRoot), new URL(file, pictureOutput));
for (const directory of ["src/", "res/upstream/"])
  cpSync(new URL(directory, pictureRoot), new URL(directory, pictureOutput), {
    recursive: true,
  });
copyFileSync(
  new URL("../puzlwerk-picture-source.json", import.meta.url),
  new URL("source.json", pictureOutput),
);
