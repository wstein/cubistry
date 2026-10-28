# Certified fixed-print counter traversal

The prominent **Application** selector defaults directly to certified Counter
00–99 at canonical 00. Leading-zero formatting uses this immutable print;
Blank tens next to Wrap selects the compatible original unpadded print and
clearly removes the certified-route claim. Configuration resets session
accounting to zero. The title is permanently printed as COUNTER; the underlying
explicit immutable-title APIs retain their orientation/copy requirements.
See [current control semantics](COUNTER_CONTROLS.md). No counting operation
replaces sticker images.

## Route and accounting

From canonical 00, 99 adjacent increments execute **exactly 339 committed HTM**,
with at most five moves per transition. The inverse route executes 339 HTM and
restores every complete prior state. The five-HTM source-to-00 setup is excluded.
Configuration initializes an already configured cube, like the original print;
it does not pretend to animate or count that setup. The initial session is zero.

Certified eligibility compares all eight cubie IDs, positions and body frames
against the canonical source, with the current immutable print identity. Visible
digits alone are insufficient. A rear-face turn can preserve the front display
while invalidating eligibility. Only eligible adjacent steps use stored words
(or their exact inverses). Arbitrary jumps, wraparound and noncanonical states
use the existing shared PuzlWerk **exactPhysical** solver from the authoritative
state to the selected complete canonical target. Its actual face turns are
animated and counted. The verified full target permits certified steps to resume;
no hidden state is silently changed and no separate recovery teleport is used.

The 339 result applies only to the certified adjacent route. It is not a bound
for arbitrary jumps, nor a claim of globally optimal printing, hidden-state
routing or exact-frame solver paths. Those broader optimality claims remain
**UNKNOWN**. Session reset, timer controls, queues and stop-after-value retain
their existing semantics. Failed/rejected animations count only prior commits.

## Evidence and independent replay

The immutable source snapshot is Cubistry commit
`7c05d28e97ecf30848220f5c70cb3100a4f3628d`, directory
`research/counter-2x2-optimization/`. The research migration target is
`research/cube-display-feasibility`; network access was unavailable during local
implementation, so the local snapshot pin is the verified source, not a claim
about the currently hosted branch head. Its original manifests and branch-name
fields are preserved byte for byte in
[the evidence directory](../research/certified-counter/evidence/manifest.json).
No optimizer, proof, certificate or protected branch is modified.

[Integration provenance](../research/certified-counter/integration.json) binds
copied evidence and the derived, versioned runtime payload. Runtime transport
checks the payload SHA-256 before schema/geometry validation and replays every
edge with the shared mechanics before enabling the selected print. The renderer
uses the existing licensed digit/font assets; their source image identities and
upright frames are retained, rather than copying sample research-net artwork.

```sh
npm run check
python3 research/certified-counter/verify.py
npm run test:e2e
npm run test:pages
```

Node tests record actual controller commits to ignored
`test-results/certified-commits.json`. The independent Python checker imports the
separately implemented rigid-sticker replayer, verifies original evidence hashes,
replays those actual words, and compares all 24 sticker identities, positions,
normals and print-up vectors with each complete recorded state. Negative controls
reject changed evidence, runtime edges, omitted commits and hidden-state changes.
Browser tests execute all 99 steps through the actual viewer, record a separate
trace and check rendered digits/baselines at representative values. Replay that
browser trace with:

```sh
python3 research/certified-counter/verify.py /tmp/cubistry-certified-browser-commits.json
```

These checks establish the fixed-print route and executed-state accounting.
They do not establish physical printer fit, human turning speed or optimal
arbitrary navigation. No new solver algorithm or distance table is introduced.
