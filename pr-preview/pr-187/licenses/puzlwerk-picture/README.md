# Private bounded 3×3 picture solver

API version 1, package version 0.1.0. This is a private source package, not an
npm release. See `src/index.d.ts` for the complete request/result types.

`solvePicture3x3` accepts 54 row-major URFDLB facelets in U/R/F/D/L/B order,
six actual center twists in U/L/F/R/B/D order, optical goal periods 1/2/4,
and explicit depth/node bounds. Call it inside a worker with a hard deadline.
A budget miss returns `unknown`, never an impossibility result or a color-only
answer. There is no optimality, completeness or universal 21-move guarantee.

The engine and its twelve-source module closure are retained from CubeLab
`08e079f3bc211777d8980f75ec6a7f61979dd2ac`, with original source hashes in
`provenance.json`, AGPL license and upstream notices. Original source paths are
recorded there. Generated ES modules are included beside their ReScript inputs.

Reproduce from the PuzlWerk repository using the committed lockfile:

```sh
npm ci
npm run build
npm run check
npm run test:package
```

The package also contains its own ReScript build configuration. To regenerate
an unpacked package's generated modules, install the declared runtime and run
ReScript 12.3.1 from this directory:

```sh
npm install --ignore-scripts
npm exec --package=rescript@12.3.1 -- rescript build
```

Canonical reference and acceptance:
https://github.com/wstein/puzlwerk/tree/feat/3x3-picture-solver/specs/005-solver-3x3-picture

`centerKernelReference` constructs an exact, bounded source-history reference
for legal center-only differences. It is not a short-solution claim. If a
consumer uses its inverse as a physical fallback, those moves must be counted.
The underlying 2,048-state kernel is checked; its constructed maximum is 286 HTM.
