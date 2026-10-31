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
