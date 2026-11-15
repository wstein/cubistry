# Calendar solver redistribution notices

The calendar worker bundles `cubing@0.66.1`. Original cubing.js code is distributed
under MPL-2.0, one of the upstream package's offered licenses. Vendored components
retain their own licenses: this selection does not relabel GPL, MIT, Apache or
public-domain code. Full upstream notices and license texts are retained here.
The unmodified source files are bundled/minified by Vite, not edited in place.

## Corresponding source and attribution

- cubing.js: the js.cubing.net team; exact release source at
  https://github.com/cubing/cubing.js/tree/8544249ff1e662557df912065a26b5f90f4df574
  and downloadable source at
  https://github.com/cubing/cubing.js/archive/8544249ff1e662557df912065a26b5f90f4df574.tar.gz.
  The package's exact README, metadata and MPL/GPL texts are retained.
  The README is stored as `cubing-README.upstream.txt`, byte-for-byte unchanged;
  its original relative links refer to the upstream source tree, not this app.
- Vendored min2phase/csTimer/FTO: Chen Shuang and the upstream contributors.
  The exact cubing release above contains the corresponding vendored source.
  The retained original min2phase README includes its dual GPL/MIT license;
  csTimer's supplied GPL text and FTO's attributed MIT notice are also retained.
- Vendored xyzzy solvers: torchlight/xyzzy. Their original GPL permission comments
  are retained verbatim, together with the complete GPL text and corresponding
  source link above.
- Bundled Comlink: copyright 2019 Google LLC, Apache-2.0. Exact license from
  `@cubing/comlink-everywhere@0.1.3` is retained, as is cubing's source attribution.
  Source: https://codeberg.org/cubing/comlink-everywhere at
  `ffcde296ff3f605ba012a7511090059daab28133`.
- LazyPromise: Lucas Garron; `@cubing/lazy-promise@0.1.3` declares MIT. Its exact
  package metadata is retained. Neither that npm package nor its upstream
  repository supplies a separate LICENSE file; no copyright notice is invented.
  MIT permission/warranty terms are retained separately. Corresponding source:
  https://codeberg.org/cubing/lazy-promise at
  `3922c09601369db60751bda48f8a26dff4261346`.
- `random-uint-below@3.3.0`: Lucas Garron, Unlicense. The exact shipped license is
  retained. Source: https://github.com/lgarron/random-uint-below.js.

## Bundled WebAssembly

Although the calendar calls the JavaScript 3×3 min2phase solver, cubing's worker
API also emits its optional twips WebAssembly implementation. Its pinned
MPL-2.0 source version is recorded verbatim in `twips-version.txt`:
https://github.com/cubing/twips/tree/2bde869a68254163a1cf16300d1ce7d98c4f8493.
The same full source can be downloaded at
https://github.com/cubing/twips/archive/2bde869a68254163a1cf16300d1ce7d98c4f8493.tar.gz.

`twips-Cargo.lock` is the exact upstream lockfile. `twips-crate-notices.json`
records a conservative 101-crate registry dependency closure from `twips-wasm`,
including optional and target-specific dependencies. It is not a claim that
all those crates are linked into this WASM binary. License and notice files were
extracted from the exact registry archives only after their SHA-256 matched the
lockfile checksums; retained file hashes and source archive URLs are recorded.
Only notice files and metadata are shipped, not downloaded crate archives or
build tools. Sources are available through each recorded registry archive URL.

Several upstream crates do not include a separate license file in their archive.
Their declared license, author metadata, repository and exact source archive are
retained honestly in the inventory; common MPL-2.0 and MIT terms are included.
The wasip2 Apache/LLVM-exception license directory is retained in full.

## Build handling

`scripts/copy-solver-notices.mjs` copies this directory to
`dist/licenses/cubing/` in every production build. `provenance.json` records the
exact upstream attribution paths and hashes. No license text or copyright notice
has been rewritten to follow the application's spelling conventions.

The two retained Cargo VCS metadata files use the visible name `cargo-vcs-info.json` so static artifacts meet the existing path rules. Their bytes are unchanged; the inventory records the original `.cargo_vcs_info.json` name.
