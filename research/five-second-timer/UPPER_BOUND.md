# Independent feasibility audit for Issue 58

Baseline inspected: `39cb33ba730ddf4b66b1a52c67fc0f220ae43a21` on the requested
`feat/30-workshop-countdown` base. No PR #56 worktree, branch, source or proof
artifact was modified by this reviewer.

## Frozen claim and assumptions

For a fixed 2x2 with eight rigid corner cubies and 24 immutable, single-digit
stickers, a fixed front MM/SS display with exact upright digit frames and no
cross-digit/rotational optical aliases cannot include every five-second display
from 00:00 through 40:00. All six outer-face moves are allowed, and all cubies
may move. No assumption restricts source face placement or upright quarter-turn
choice beyond proper physical frames. This does not establish bounds under an
optical-symmetry relaxation or a different display architecture.

The existing physical verifier's signed-frame invariant is independently
recomputed over all 96 possible source corner/outward-normal/tangent-up frames
and all 24 proper rotations (2304 checks). Every useful sticker belongs to
exactly one upright front slot: its `(p dot up, p dot (up cross normal))` pair.
Any source ink orientation not capable of an upright target is merely an
unused face and cannot evade the budget.

## Upper-bound result: UNSAT at 40:00

The actual 480 states 00:00..39:55 are exactly the Cartesian product of slot
class counts `(4,10,6,2)`. Adding 40:00 introduces minute-tens digit 4, requiring
23 distinct slot/digit classes. With only 24 faces, at most one required class
can be duplicated. This budget is only the first reduction, not the proof.

Two nonduplicated classes from different slots cannot share a cubie, since a
Cartesian target requires them together. Their cubie bins must be disjoint by
slot. With no duplicated old class (including the possibilities of duplicating
new digit A4 or leaving an irrelevant extra face), the 22 old classes require
`ceil(4/3)+ceil(10/3)+ceil(6/3)+ceil(2/3)=9` occupied cubies. Duplicating C or D
still leaves nine necessary cubies. These three cases are impossible.

For duplicate A or B, the minimum occupies all eight cubies. The audit enumerates
all positive <=3 occupancy partitions for each slot's unique classes and every
pair of remaining faces for the duplicate. There are 12 placements after the
stated symmetries. It checks distinct-cubie matching on every one of the 480 old
Cartesian targets. Only two skeleton families survive: duplicate A in two B
bins, or duplicate B in both A bins. In both families the remaining face for
new A4 is in the sole D bin, which contains unique D0. The required 40:00 target
therefore repeats the same cubie for A4 and D0 and is impossible.

Digit/bin permutations inside a slot preserve the old Cartesian constraints.
Although the 40:00 extension distinguishes specific zero labels, the rejection
uses only A4 and D0; D0 is necessarily in the sole D bin in both surviving
families. No extension case is lost by the symmetry reduction.

This is an independently executed structural proof for a relaxation of physical
reachability. Its impossibility therefore applies to the stricter legal-move
model. Every longer continuous range contains 40:00 and is also excluded.

## Constructive lower bound: UNKNOWN pending physical replay

The proposed 39:55 layout has been independently checked for abstract matching
coverage of all 480 targets, with bins:

- A{0,1,2}
- B{0,1,2}
- B{3,4,5}
- B{6,7} + A3
- B{8,9} + A3
- C{0,1,2}
- C{3,4,5}
- D{0,5,0}

This is not yet a SAT classification. The author must supply actual facelet
normal/up assignments, complete physical states, legal setup/transition words,
and independent exact sticker/body replay. If verified, 39:55 (2395 seconds,
480 inclusive states, 479 adjacent edges) combined with the upper proof is the
true maximum in the frozen model, and includes exact 30:00 (361-prefix states).

## Reproduction and artifacts

`python3 research/five-second-timer/upper_bound.py research/five-second-timer/upper-bound.json`

The independent script uses Python standard library only; it imports neither
the generator nor the existing physical verifier. It derives actual time-domain
requirements, checks every rotation invariant, exhausts the structural cases,
and preserves its two surviving old-domain skeletons and final contradictions.
The generated `upper-bound.json` and independent scratch audit log record the successful run.

The reviewer has not assessed animation performance, HTM optimization, actual
SAT witnesses or application integration yet. No merge, deployment or readiness
action is authorized by this audit.
