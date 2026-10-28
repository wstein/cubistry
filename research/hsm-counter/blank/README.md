# H/S/M counter with a real blank upper-left sticker

The user clarified that upper-left means **blank**, not unconstrained. The
previous three-corner HSM result and runtime print therefore do not satisfy
the corrected visual requirement. They remain preserved historical evidence.

**SAT** for this new immutable 24-sticker print: all 180 combinations of H/S/M
and 00–59 display a genuinely unprinted upper-left sticker, the upright letter
upper-right, and upright tens/units below. One corner has three blank faces;
the other seven corners carry six tens glyphs, twelve units glyphs including
duplicates, and H/S/M. No screen masking or relabeling is involved.

## Independently verified bounds

- **At most six HTM for any target from any legal pose.** The independent
  four-corner graph covers 136,080 states and allows all three blank-corner
  twists. This is the general replanning bound accepted by the user.
- **At most five HTM on the exact canonical counting runs:** all 18
  letter/range/direction modes have checked full-state preperiods and periods,
  with 8,292 actual counting edges and all 180 displays. Full period closure
  permits indefinite repetition of those particular runs.
- Five is **not a universal bound** for the corrected print. From legal setup
  `U D2 B D'`, displaying blank/H/00, the target blank/H/34 has shortest length
  six. One shortest word is `R F' D F2 R' D`.

The canonical five-move statement requires the exact saved setup and policy.
It does not automatically cover Run after arbitrary Set, a different 00 pose,
or direction/range changes from other physical states. Those operations remain
within the general six-move result. The user explicitly accepted six for free
jumps and other starting states. An application must not retain the prior
unqualified “every transition at most five” description.

The canonical policy is 13 except M/00–59/down, where policy 1 avoids a six-move
edge. The earlier all-policy-13 candidate is retained in
[witness-policy13.json](witness-policy13.json) as historical context. Only the
selected [witness.json](witness.json) has the independently accepted canonical
five-move result. Neither print nor whole-route optimality is claimed.

## Evidence and reproduction

See [REVIEW.md](REVIEW.md), [verification.json](verification.json), and
[manifest.json](manifest.json) for the independent verdict, exact graph counts,
actual counterexample, environment, hashes, and test results.

Run from the Research branch root with Node.js 24 and standard-library Python:

```sh
node research/hsm-counter/blank/generate.mjs NEW_OUTPUT_PATH
python3 research/hsm-counter/blank/verify.py
python3 -m unittest discover -s research/hsm-counter/blank -p 'test_verify.py' -v
```

Generation requires no external packages and refuses to overwrite the output.
`HSM_BLANK_DOWN_POLICY=13` reproduces the older last-mode policy. Three tests
and ten negative controls pass. A positive control reverses the fictitious up
vectors of every blank sticker; visible correctness remains unchanged.

The independent verifier uses its own integer Rodrigues engine and imports no
generator geometry. It checks fixed images, all 24 physical frames, exact blank
placement, shortest paths, full-state period closure, and the explicit six-move
counterexample. Application integration and browser tests are separate evidence.
