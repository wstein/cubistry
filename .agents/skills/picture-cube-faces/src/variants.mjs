/** Variant fan-out helpers (pure). Layout: <theme>/<variant>/ is the current build, <theme>/<variant>/v1/, v2/ hold
 * earlier builds. A variant name is <group>-<letter>, e.g. b-a / b-b (belt), u-a / u-b (Up), d-a / d-b (Down).
 * Rule: two variants per open question. */
export const RATING_AXES = ["legibility", "story", "charm", "calm", "overall"];
export const isVariantName = (s) => /^[a-z][a-z0-9]*-[a-z]$/.test(s);

/** Variant names grouped by question: ["b-a", "b-b", "u-a"] -> { b: ["b-a", "b-b"], u: ["u-a"] }. */
export function groupVariants(names) {
  const out = {};
  for (const n of names.filter(isVariantName)) (out[n.split("-")[0]] ??= []).push(n);
  for (const g of Object.values(out)) g.sort();
  return out;
}

/** Groups that violate "two variants per open question" (exactly two are expected). */
export const badGroups = (names) => Object.entries(groupVariants(names)).filter(([, v]) => v.length !== 2).map(([g, v]) => ({ group: g, count: v.length }));

/** Empty rating table (markdown): 1-5 for legibility, story, charm, calm, plus overall. */
export function ratingTableMd(variants) {
  const head = `| Variant | ${RATING_AXES.map((a) => a[0].toUpperCase() + a.slice(1)).join(" | ")} | Weaknesses |`;
  const sep = `|---|${RATING_AXES.map(() => "---").join("|")}|---|`;
  return [head, sep, ...variants.map((v) => `| ${v} | ${RATING_AXES.map(() => "").join(" | ")} |  |`)].join("\n") + "\n";
}

/** Parses a filled rating table back into numbers (rows with all five values 1-5). */
export function parseRatings(md) {
  const rows = [];
  for (const line of md.split("\n")) {
    const cells = line.split("|").slice(1, -1).map((c) => c.trim());
    if (cells.length < 6 || !/^[a-z][a-z0-9]*(-[a-z])?$/.test(cells[0])) continue;
    const nums = cells.slice(1, 6).map(Number);
    if (nums.every((v) => Number.isInteger(v) && v >= 1 && v <= 5)) rows.push({ variant: cells[0], ...Object.fromEntries(RATING_AXES.map((a, i) => [a, nums[i]])) });
  }
  return rows;
}
