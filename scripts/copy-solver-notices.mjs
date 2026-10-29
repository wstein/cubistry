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
