# Constructive legal-word generation for the English candidate

These files generate candidate legal-move witnesses. GAP output, group membership,
and a front matching alone do **not** establish SAT. The stored printing and raw
word DAG require independent native Julia and Flix physical replay.

## Action and frame information

`group_action_audit.jl` independently constructs a 264-point faithful pose action:
eleven physical piece-orbit types, each with 24 proper-rotation poses. The point
records are `(body, normal, up)`; corner and midge face information and all four
core-center spins are retained. No six-position-only center approximation is
used. The action lifts to the 218 rigid cubies and their 294 immutable stickers.

`action.g` contains 21 legal positive quarter-turn generators. For each x/y/z
axis, the order is layers -3,-2,-1,1,2,3 followed by a whole-cube rotation.
Whole-cube generators are therefore 7,14,21. Positive turns are
`(x,y,z) -> (x,-z,y)`, `(z,y,-x)`, and `(-y,x,z)` respectively.

`front-base.tsv` identifies one complete pose point for each of the 49 front
bodies, in row-major order. The target tuples are derived from a single actual
printing by the author's separate native Julia front matcher. If `T` is this
fixed tuple and `S` a target's selected home-pose tuple, a required move word `g`
satisfies `OnTuples(S,g)=T`.

## Constructive transporter

For a stabilizer chain ordered by `T`, maintain `T_previous^w=S_previous`.
Choose `h` in the stabilizer of previous T points so that
`T_i^h=S_i^(w^-1)`, then replace `w` by `h*w`. The final inverse `g=w^-1`
maps all selected source poses to the target front. Hidden cubies are completed
by the resulting legal group element automatically; no unproved assertion that
parity constraints are sufficient is needed.

GAP's supplied base option is only preferential. The constructor did not retain
the exact requested front order. Changing a generic labeled chain directly also
does not preserve its word labels. `rebase_legal_chain.g` therefore changes a
plain copy, then obtains each new transversal's word from an untouched complete
resolver chain and checks its actual permutation. The small tests retain both
the detected failure and corrected method.

`dag_words.g` stores a permutation and a signed word-node ID together. Products
and inverses retain compact original-generator expressions instead of merging
large straight-line programs. GAP's generic `Factorization` enumerates group
elements and is unsuitable here; its built-in SLP merging was also slow in this
experiment. Neither failed approach supplies proof evidence.

The 213-digit order in `known_order.g` was measured by GAP and is used only as a
candidate-generation hint. Even an erroneous hint cannot make a bad generated
word pass independent physical replay. Failed generation is UNKNOWN, not UNSAT.

## Published word format

The repository stores lossless `.tsv.gz` archives to keep the large word data out
of textual diffs. `word-archives.json` pins compressed and raw bytes. Native
checkers consume the decompressed TSV; decompression is data transport, not a
proof decision. For example:

```sh
gzip -dc research/calendar-7x7/en-physical-review/all-targets-dag.tsv.gz > /tmp/calendar7-english-legal-dag.tsv
julia --startup-file=no research/calendar-7x7/english/replay_legal.jl /tmp/calendar7-english-legal-dag.tsv
```

The generated raw `all-targets-dag.tsv` uses canonical LF TSV:

```text
cubistry.calendar7.legal-dag.v1<TAB>264<TAB>21
generator<TAB>node<TAB>original-generator-index
product<TAB>new-node<TAB>signed-left-node<TAB>signed-right-node
result<TAB>target-index<TAB>signed-root-node
```

Zero denotes the identity, a negative node denotes its inverse, and all product
references point to earlier nodes. Multiplication is right action: apply the left
word first, then the right word. Ancestor pruning retains only required products;
the 21 original generator nodes are retained. There are no unproved derived seeds.

For the current English candidate printing, the pooled certificate contains 230,384 nodes
and 91 roots. The raw SHA-256 is
`ef2071eceb3f7e1934c4b67684613044e38d0446f16e86f4d0ba112ddc9f9f24`.
The clean one-shot generator reproduced these exact bytes in this environment.
The surrounding proof manifest names any compressed published archive.

`dag_leaf_counts.jl` uses native Julia `BigInt` arithmetic to count layer and
whole-cube generator leaves separately. `unreduced-leaf-counts.tsv` records the
counts for every root. These generic stabilizer-chain words are astronomically
long when expanded. They are **existence witnesses, not practical playback,
HTM-optimal paths, or optimized transitions**. Cancellation and half-turn
compression have not been applied to these leaf counts.

## Reproduce candidate generation

First regenerate action data with Julia 1.13.3:

```sh
julia --startup-file=no research/calendar-7x7/en-physical-review/group_action_audit.jl
```

Then use GAP 4.14.0 with `--quitonbreak` and its normal libraries available:

```sh
gap --quitonbreak -A -q research/calendar-7x7/en-physical-review/generate_legal.g
```

`calendarGoalFile` and `calendarWitnessFile` may be set before reading that script
to generate a separate candidate, including an optimized printing. Do not
overwrite a pinned baseline. The default goal file is the English author's
`english/evidence/front-goals.g`.

GAP's default behavior can report an error and still exit zero after EOF. The
driver must use `--quitonbreak`, require its final completion record, and then
execute both native physical validators. The isolated local GAP installation and
saved workspaces are tooling caches, not repository artifacts or proof authority.

The successful one-shot generation measured about 1.9 seconds for the DAG-labeled
chain, 4.2 seconds for exact rebase/word resolution, and 0.2 seconds for all 91
transporters, plus export. These are engineering observations on this container,
not mathematical guarantees or benchmark comparisons across languages.
