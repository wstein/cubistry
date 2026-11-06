/** Version history for rebuild-in-place: before a rebuild the current files move into v1/, v2/, ... */
import { existsSync, mkdirSync, readdirSync, copyFileSync, statSync } from "node:fs";

const KEEP = /\.(svg|png|json|txt|md)$/i;

/** Number of the next history folder (v1 when none exists). */
export function nextVersion(dir) {
  if (!existsSync(dir)) return 1;
  const nums = readdirSync(dir).map((n) => /^v(\d+)$/.exec(n)?.[1]).filter(Boolean).map(Number);
  return nums.length ? Math.max(...nums) + 1 : 1;
}

/** Copies the top-level result files of `dir` into dir/vN/ (never recursive, never into itself). Returns the folder or null. */
export function archiveCurrent(dir) {
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir).filter((n) => KEEP.test(n) && statSync(`${dir}/${n}`).isFile());
  if (!files.some((n) => /^[ULFRBD]\.svg$/.test(n))) return null; // nothing built yet
  const target = `${dir}/v${nextVersion(dir)}`;
  mkdirSync(target);
  for (const n of files) copyFileSync(`${dir}/${n}`, `${target}/${n}`);
  return target;
}
