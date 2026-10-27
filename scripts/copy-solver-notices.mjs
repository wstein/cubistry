// Keep the dependency's exact attribution/license data with the built preview.
import { mkdirSync, copyFileSync } from "node:fs";
import { TABLE_URL } from "@puzlwerk/solver-2x2";
const destination = new URL("../dist/licenses/puzlwerk/", import.meta.url);
mkdirSync(destination, { recursive: true });
for (const file of ["LICENSE", "NOTICE", "COPYING", "provenance.json"])
  copyFileSync(
    new URL("../" + file, TABLE_URL),
    new URL(file, destination),
  );
copyFileSync(
  new URL("../puzlwerk-source.json", import.meta.url),
  new URL("source.json", destination),
);
