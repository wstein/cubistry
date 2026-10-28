# Independent review of the real-blank H/S/M correction

Verdict: **SAT** for the new immutable print and all 180 required displays with
an actual unprinted upper-left sticker. All 18 saved canonical counting modes
also have independently checked full-state periods with at most five HTM per
edge. These are separate claims from the universal arbitrary-source bound,
which is **six**, not five, for this corrected print.

Reviewed witness SHA-256:
`13eea2a1ad88561775158a70633b80e25d06f883e42d44aafb4e6808699be47b`.

## Corrected requirement and physical print

The earlier print and its three-corner proof left upper-left unconstrained.
They do not satisfy the user's clarified four-cell requirement and cannot
justify this correction. The new settled front is exactly:

```text
blank  H/S/M
tens   units
```

Blank means an actually unprinted sticker on the cube, not a hidden renderer
glyph, a transparent overlay, or an unconstrained cell. Three blank stickers
share one physical corner. Two other corners carry tens 0–5; four carry units
0–9 with duplicates; one carries H/S/M. The checker verifies all 24 immutable
sticker identities and frames, all eight rigid corner bodies, and this exact
constructive print. Every nonblank glyph is upright. The up vector of blank
artwork has no visible meaning and is ignored for display matching.

## Independent four-corner bound

The new checker reuses only the earlier independently authored integer
Rodrigues engine. No author geometry, generator, solver, or JavaScript is
imported. It rebuilds a four-corner graph with
`8 × 7 × 6 × 5 × 3⁴ = 136,080` states.

Because all three faces of the blank corner are unprinted, any of its three
twists at upper-left is an acceptable goal. A multi-source BFS includes all
three goal twists, with the letter and both digits upright. It has maximum
distance **six** over all 136,080 physical source poses. Consequently every
required display is reachable within six HTM from any legal pose for this
print; the blank cannot be treated as an oriented character to tighten this.

Restricting sources to an already correct blank/letter top row leaves 810
marker poses. Their independently checked distance histogram is:

| Minimum HTM | Source poses |
| --- | ---: |
| 0 | 3 |
| 1 | 9 |
| 2 | 27 |
| 3 | 99 |
| 4 | 273 |
| 5 | 363 |
| 6 | 36 |

Thus allowing all blank orientations does **not** restore the earlier
universal five-move statement.

There is a concrete counterexample on the actual new print. From its source
print, apply `U D2 B D'`: the visible face is blank/H/00, a valid settled
display and the first saved canonical setup. Reaching blank/H/34 from that
exact full pose requires **six HTM**, independently established by the
exhaustive graph over every matching immutable digit selection and all three
blank twists. A shortest legal word is:

```text
R F' D F2 R' D
```

That word is physically replayed, its exact target checked, and its inverse
verified to restore the complete counterexample source. The structured result
retains the actual source state and its legal source word.

## Five-move canonical counting periods

The current witness has all 18 combinations of H/S/M, ranges 00–11/23/59,
and forward/backward counting. All 8,292 retained preperiod/period edges pass
independent physical replay. Every setup and settled edge has a real blank
upper-left; all 180 letter/number displays occur. Every saved counting edge
is shortest from its actual source and costs at most five HTM, including
wraps such as 11→00, 23→00, and 59→00.

For every mode the checker verifies exact modular number order, every complete
physical move presentation, every inverse edge, and equality of all 24 sticker
identities, positions, normals, and up vectors at the period start and final
endpoint. Repeating that full-state period proves unlimited repetition of that
specific canonical mode at its recorded ceiling. Policy 13 is recorded for
all modes except M / 00–59 / backward, which records policy 1.

This five-move assertion requires the exact certified setup/full-pose route.
It does not automatically apply after a manual Set, a range or direction
change at another pose, a different 00 setup, or an arbitrary jump. Those
operations have the universal six-move guarantee unless separately proved.
An application must not retain the old “every transition at most five” claim
or substitute an image mask while claiming to implement this physical proof.

The earlier policy-13-only candidate remains historical evidence. Its existence
does not establish the new canonical five-move result; the exact witness hash
above and its physically checked periods do.

## Reproduction and controls

```sh
python3 research/hsm-counter/blank/verify.py
python3 -m unittest discover -s research/hsm-counter/blank -p 'test_verify.py' -v
```

The result is saved in [verification.json](verification.json). Tests check
fresh complete acceptance, all 18 modes and 180 displays, the six-move actual
counterexample, and ten corrupted-witness controls. A positive control reverses
all three blank stickers' fictitious up vectors; the complete canonical
five-move periods remain valid, confirming that blank orientation is free.

No unresolved physical-proof findings remain for these exact claims. This
review does not approve any application implementation. Global print or
whole-route optimality is UNKNOWN; the counterexample rules out universal
five-move replanning for this print, not every possible different print.
