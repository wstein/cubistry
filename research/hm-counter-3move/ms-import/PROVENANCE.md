# Provenance of the imported M/S witnesses

Copied verbatim from the unmerged M/S counter study (PR #138):
`origin/research/ms-counter-3move` at commit
`d4973120620de9dd1ccddabf1ed5543547c7c611`, paths
`research/ms-counter-3move/evidence/witness-s3.tsv` and
`research/ms-counter-3move/evidence/witness-m3.tsv`.

They are used only as print and route seeds. `msconvert.jl` turns their
sticker rows into this folder's print tokens with a letter relabeling (for
example S→H) and their up runs into a routes file. Every claim in this folder
is re-checked by this folder's Julia and Flix checkers. Nothing here depends on
that branch.

## Differences between the imported prints and the derived witnesses

Checked by replaying the imported sticker rows with the Julia checker's own
functions and comparing every (position, normal) facelet with the derived
witness:

- **m3-SH** and **s3-SH**: identical frames, except the letter relabeling
  (S→H) and **3 blank-sticker up vectors**, which were normalized because
  `msconvert.jl` writes every blank as the token `_0`, which carries no
  orientation from the source, and the witness writer derives every up vector
  from the print token. A blank reads as blank in every orientation,
  so this has no physical effect and changes no check (the display check
  ignores a blank's up vector and the lower bound tries every tangent of a
  blank).
- **s3-MH**: its reference print state is S3's state after S3's S setup word
  `F2 L U' B2 D R2 U R' B2`, so that the S period becomes the M period with
  setup `-`; its H setups start with the inverse word. After that replay the
  only differences are the relabeling (S→M, M→H) and the same 3 normalized
  blank up vectors.
