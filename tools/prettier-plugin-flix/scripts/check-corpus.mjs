// Usage: node scripts/check-corpus.mjs <dir-or-file>...  — formats each .flix file and verifies it.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fingerprint, fmt, dropTrailingCommas } from "../test/lib.mjs";

const files = [];
const walk = (p) => {
    if (statSync(p).isDirectory()) { for (const e of readdirSync(p)) if (e !== "node_modules" && e !== ".git") walk(join(p, e)); }
    else if (p.endsWith(".flix")) files.push(p);
};
process.argv.slice(2).forEach(walk);

let bad = 0, skipped = 0;
for (const f of files) {
    const t0 = Date.now();
    const src = readFileSync(f, "utf8");
    const a = fingerprint(src);
    if (a.errors.length) { skipped++; continue; }
    const problems = [];
    let out;
    try { out = await fmt(src); } catch (e) { problems.push("format threw: " + String(e.message).split("\n")[0]); }
    if (out !== undefined) {
        const b = fingerprint(out);
        if (b.errors.length) problems.push("output does not parse: " + b.errors[0]);
        else {
            if (JSON.stringify(dropTrailingCommas(a.tokens)) !== JSON.stringify(dropTrailingCommas(b.tokens))) problems.push("tokens differ");
            if (JSON.stringify(a.comments) !== JSON.stringify(b.comments)) problems.push("comments differ");
            if (a.shape.replace(/Context/g, "") !== b.shape.replace(/Context/g, "") && !problems.length) problems.push("tree shape differs");
            const again = await fmt(out);
            if (again !== out) problems.push("not idempotent");
        }
    }
    if (process.env.TIMING) console.log(`${Date.now() - t0}ms ${f}`);
    if (problems.length) { bad++; console.log(`FAIL ${f}: ${problems.join("; ")}`); }
}
console.log(`${files.length} files, ${skipped} skipped (do not parse), ${bad} failing`);
process.exit(bad ? 1 : 0);
