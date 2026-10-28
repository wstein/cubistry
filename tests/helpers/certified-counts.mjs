// Explicit regression counts between pinned optimized complete states. The legacy
// consumer's separate expectations remain in shared-solver.mjs and its Node tests.
const counts = { "15,42": 9, "42,44": 8, "42,7": 7, "15,7": 9 };
export function expectedCertifiedHtm(from, to) {
  const count = counts[`${from},${to}`];
  if (count === undefined)
    throw Error(`Missing optimized regression ${from}→${to}`);
  return count;
}
