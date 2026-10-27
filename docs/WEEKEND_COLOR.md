# Red German weekends, 1900–2099: independently verified UNSAT

This separate investigation asks whether SAM and SON can be printed entirely
in accent red while MON, DIE, MIT, DON, and FRE remain anthracite. Under the
otherwise unchanged [German baseline](GERMAN_BASELINE_1900.md), the result is
**UNSAT**, even allowing an entirely new immutable joint printing.
The baseline's original anthracite weekdays remain SAT.

## Frozen scope

* Existing physical 5×5, immutable sticker images/inks/frames and cubie coupling.
* All 73,049 valid Gregorian dates in 1900–2099 and all 1,440 minutes per date.
* Zero-padded red day/month, split gray year `19 89` / `20 26`, blue time digits,
  red colon, and **three** fixed upright full-image logo fragments in row 4
  columns 2–4, with both outer cells blank.
* SAM and SON are entirely red. The five remaining weekday names are entirely
  anthracite. Red uses the existing date accent ink (`date-red`); anthracite is
  the existing symbolic ink name `weekday-black`. No exact RGB is assumed.
* No sticker changes color between targets. Glyph/image identity is preserved;
  no 6/9 or other character substitution is allowed.

This is independent of the [four-fragment logo investigation](GERMAN_FOUR_LOGO.md).
It starts with the proven three-fragment target layout, not the UNSAT four-image
variant. It does not enlarge the year range or start the deferred bilingual work.

## Corrected weekday inventory and source capacity audit

The preliminary estimate contains one extra anthracite M: at the final weekday
position, M appears only in SAM, so it is needed in red and not anthracite.
The independently enumerated minimum image/ink/position **type** counts are:

| Weekday position | Cubie class | Anthracite | Red | Types |
| --- | --- | --- | --- | --- |
| 1 | Corners | M,D,F | S | 4 |
| 2 | Wings | O,I,R | A,O | 5 |
| 3 | Middle edges | N,E,T | M,N | 5 |
| Total | | 9 | 5 | **14** |

The all-anthracite baseline has 12 types (4+4+4), so the net increase is **two**,
not three. Five red identities are introduced while the anthracite S, A, and
final M are removed. O and final N need both colors. Type counts are not a
physical print plan: coupling can require multiple copies of the same type.

The existing source printing is
[the two-hundreds witness](../results/german-century-09.json). Its full audit
is saved [separately](../results/baseline-1900-2099/weekend-color-capacity-audit.json).
It declares all 24 wing cubies allocated. Four unassigned middle-edge sticker
positions belong to two otherwise unallocated cubies; three axial centers and
five diagonal centers are also unassigned. Those positions cannot migrate to
the wing orbit. Fixed centers cannot move into those display positions and are excluded from
movable reserves.
These are source-declaration counts, not a globally maximized reserve proof.

Corners need no additional letter type: recoloring the source's first-position
S works locally because every such S belongs to SAM/SON. The middle-edge role
can pack five final-letter image/ink types on three dedicated two-sticker
cubies instead of two; the source has two unallocated middle-edge cubies, so
that local role grouping would fit. Neither observation proves a global SAT.

The unchanged source print itself already fails on Sunday **1900-01-07 at
00:00**: it has no red O on any wing sticker for front row 1, column 2. A red O
on another physical orbit cannot serve that wing position. This counterexample
to the old print alone is not used as the new universal impossibility proof.

## Physical wing proof for every possible new printing

The fourth logo cell remains blank, so the previous favorable repeated-blank
sharing is preserved. Nevertheless the extra red/anthracite distinction for O
increases the required A-side wing inventory from 21 to **22**. B still requires
peak inventory **16**, including two simultaneous blanks.

The independent checker rebuilds the physical 150-facelet lattice, verifies all
twelve legal quarter-turn generators and the two opposite-sign stickers per
physical wing cubie, then independently generates the complete real calendar
and time projections with explicit **(position, image, ink)** identities.
The calendar correlations and peak multiplicities are checked afresh.
The only opposite-side peak exception is still FEB's final B versus day tens 3.

There are 24 physical wing cubies and therefore 24 A and 24 B stickers:

* A's peak inventory 22 leaves two surplus copies. At most two types can have
  extras; since all A peaks are 1, at most **four A stickers** have alternatives.
* B's inventory 16 leaves eight extras. Loosening at most eight types can remove
  at most nine required peak copies, because its largest peak is the two blanks.
  Therefore at least **seven B stickers remain tight**, forced when their
  type's peak occurs.
* Each tight B sticker must pair with a loose A sticker or use the sole
  FEB/day-30 exception. That exception supplies at most one pairing.

Hence every hypothetical immutable printing would need:

```text
at least 7 tight B partners ≤ at most 4 loose A partners + 1 exception
7 > 4 + 1
```

This is a complete coupled-cubie contradiction, not an inference from the total
number of printable sticker faces or from a failed search. Every glyph rotation
is admitted in the negative proof; font symmetry and print orientation cannot
remove it. The actual colored image/ink identities alone separate the wing
roles, and simultaneous blank multiplicities are retained.

The certified conflicting subsystem consists only of the eight wing front
positions: weekday middle letter with its fixed ink, red month-final letters,
red day tens, blue hour units/minute tens, and the three target blank roles.
Corner, middle-edge, year, and center-logo constraints can all be dropped and
this contradiction still holds. This is a **reduced UNSAT core**, not a claim
that every requirement in that core is individually minimal. The source-print
counterexample above additionally supplies a concrete failing display.

## Reproduce and review

* [Candidate, frozen model, and required multiplicities](../results/baseline-1900-2099/weekend-color-candidate.json)
* [Independent verification output](../results/baseline-1900-2099/weekend-color-verification.json)
* [Input hashes, versions, commands, and review controls](../results/baseline-1900-2099/weekend-color-manifest.json)
* [Generator](../scripts/weekend-color.mjs)
* [Independent checker](../scripts/verify_weekend_color.py)

The generator reuses the ReScript German calendar/year formatter. The separate
standard-library-only checker imports no research generator or verifier helper;
it reuses the independently implemented weighted wing proof method, adapted to
explicit per-date weekday ink. It separately checks all three weekday position
inventories and the actual wing co-occurrence relation. Inconsistent weekend
rules, a lost O color identity, or a changed counting certificate must be rejected.

```sh
npm run build
timeout 60 node scripts/weekend-color.mjs > /tmp/weekend-color-candidate.json
timeout 60 python3 scripts/verify_weekend_color.py /tmp/weekend-color-candidate.json > /tmp/weekend-color-verification.json
cmp /tmp/weekend-color-candidate.json results/baseline-1900-2099/weekend-color-candidate.json
```

The result is limited to the frozen colors, formatting, and complete target set.
Other date padding, ink policies, restricted coverage, or layout changes would
be new models requiring separate authorization and verification. No production
artwork or replacement sticker print plan is claimed for this UNSAT model.
