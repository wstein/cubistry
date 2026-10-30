# Native necessary wing-coupling obstruction

This is a research-local rejection of one specified complete print profile:
DE Monday-first, all months 2026–2099, three separate uppercase month glyphs,
start 5 in January–September and start 1 in October–December, no printed year,
marked sixth-week overflow, and the declared optimistic artwork rotation/font
profile. It is not a global rejection of 7×7 calendars, other fonts, other
month schedules, or the 2026-only problem. The canonical proof checker has
not been extended or invoked. EN complete-cube feasibility remains UNKNOWN.

Run `python3 run_physical_checks.py`. Python only builds/invokes native Flix,
mutates bytes for negative controls, and records process results and digests.
Every calendar, geometry, normal-form, inventory, witness, and contradiction
check executes in `src/PhysicalDe.flix`, using the earlier independent native
Gregorian arithmetic and artwork normalizer. The checker strictly regenerates
the complete canonical reviewer TSV, compares every byte, and then checks the
universal obstruction. Alternative witness serializations are outside this
strict certificate format.

The proof is finite and covers every possible sticker pairing:

1. The checker constructs all 24 proper signed-permutation rotations and the
   orbit of the cubie at (3,3,1). Its 24 distinct physical wing pieces each have
   exactly one sticker in surface orbit A = (-3,-1) and one in B = (-3,1).
   The two sticker normals are perpendicular, so a piece can expose at most
   one of its stickers on a single front face.
2. Independent Gregorian targets with marked overflow produce 23 artwork
   classes on each side. Both sides require 24 stickers: 22 nonblank classes
   require one copy each and the blank class requires two. Since there are
   exactly 24 stickers on each side, these lower bounds are exact. There is
   no slack to duplicate a nonblank class or add an unobserved class.
3. For 20 of the 23 A classes, the certificate gives an actual year/month
   requiring every copy of that A class and both B blanks. Pairing that A
   class with a B blank would require one physical piece twice on the front.
   Those 20 A partners are therefore impossible for either B blank.
4. The only remaining A partners are canonical artwork classes (1,0,red),
   (27,3,dark), and (6,2,dark). The last class is the upright date 9 at row 5,
   column 1 in the obstruction target.
5. November 2026 requires all three of these unique A stickers simultaneously
   and also one B blank. Both physical pieces bearing B blanks must have A
   partners from this three-class set. Every such A partner is required on
   the front, so both B-blank-bearing pieces are already occupied by their A
   stickers. No B blank can face front: contradiction.

This argument quantifies over all pairings directly. It does not rely on a
chosen completion of the other 22 unique nonblank classes or on the earlier
45-branch search. A contradiction in this necessary physical relaxation rules
out any complete cube construction under the stated profile.

The raw certificate is `../../physical-review/DE-blank-obstruction.tsv`, SHA-256
`a567f89f2c13dcd37e3dc22507c49f96a27da510bec6efe8449f92db32b7129b`.
`physical-valid.stdout.tsv` records the independent classes, witnesses, and
obstruction. `physical-checks.tsv` records the valid certificate's exit 0 and
nine corrupt certificates' exit 1. `physical-toolchain.log` records source,
compiler, and generated executable digests and actual tool versions. Historical
capacity-only passing receipts remain preserved and are weaker than this check.
