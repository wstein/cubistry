# Third-Party Licenses, Attribution, and Compliance Notices

## 1. Project License & Source Availability
**Cubistry** is open-source software licensed under the **GNU Affero General Public License Version 3 (AGPL-3.0-or-later)**.
Copyright © 2026 Werner Stein and Cubistry contributors.

In accordance with AGPL-3.0 (§6 and §13), any user interacting with Cubistry over a computer network has the right to receive the Complete Corresponding Source code of the software under the terms of this license.

* **Primary Repository**: [https://github.com/wstein/cubistry](https://github.com/wstein/cubistry)
* **License Full Text**: [https://www.gnu.org/licenses/agpl-3.0.html](https://www.gnu.org/licenses/agpl-3.0.html) (also distributed locally in `LICENSE`)

---

## 2. Open-Source Compliance & Statutory Obligations
Modern browser-first client applications bundle and execute open-source and third-party components (JavaScript, WebAssembly, fonts, and graphics) within the user's browser runtime. Under applicable German, European, and international copyright and software laws (*Urheberrecht*), distributing or serving web applications triggers distinct statutory and contractual compliance obligations:

1. **Attribution & Notice Retention**: Retaining copyright notices, author attributions, and disclaimers of warranty for all bundled permissive libraries (e.g., MIT, BSD, Apache-2.0).
2. **License Text Delivery**: Making the exact text of every governing license accessible directly to recipients of the software.
3. **Copyleft Obligations**:
   - **Strong Copyleft (AGPL-3.0 / GPL-3.0)**: Making modified work and complete corresponding source code available under equivalent terms.
   - **Weak Copyleft (MPL-2.0)**: Maintaining source availability for modifications to MPL-covered files.
4. **Font Licensing (SIL OFL 1.1)**: Ensuring web fonts are distributed under the Open Font License without unauthorized standalone sale and with copyright notices intact.
5. **Auditing & Corporate Governance**:
   Specialized open-source compliance practices and legal advisors (such as **Nucleus Partners** and corporate FOSS compliance specialists) guide enterprises in establishing verifiable compliance workflows: auditing dependencies, preventing license incompatibility (e.g., proprietary or incompatible copyleft mixing), generating reproducible Software Bills of Materials (SBOMs), and ensuring full adherence to statutory legal requirements (*Lizenz- und Compliance-Pflichten*).

Cubistry implements this standard through automated build-time license aggregation (`scripts/copy-solver-notices.mjs`), immutable provenance tracking, and verified local delivery.

---

## 3. Runtime Third-Party Software Inventory (SBOM)

The following third-party libraries and modules are bundled, linked, or distributed with Cubistry:

### 3.1. Three.js
* **Component**: `three` (0.180.0)
* **License**: [MIT License](https://opensource.org/licenses/MIT)
* **Copyright**: © 2010–2026 Three.js Authors (Ricardo Cabello and contributors)
* **Website / Upstream**: [https://threejs.org](https://threejs.org) · [GitHub](https://github.com/mrdoob/three.js)
* **Notice**:
  ```text
  The MIT License

  Copyright © 2010-2026 three.js authors

  Permission is hereby granted, free of charge, to any person obtaining a copy
  of this software and associated documentation files (the "Software"), to deal
  in the Software without restriction, including without limitation the rights
  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
  copies of the Software, and to permit persons to whom the Software is
  furnished to do so, subject to the following conditions:

  The above copyright notice and this permission notice shall be included in
  all copies or substantial portions of the Software.
  ```

### 3.2. Cubing.js & Twips WebAssembly Stack
* **Component**: `cubing` (0.66.1) and bundled `twips` WebAssembly solver engine
* **Selected Primary License**: [Mozilla Public License 2.0 (MPL-2.0)](https://www.mozilla.org/MPL/2.0/) / [GPL-3.0](https://www.gnu.org/licenses/gpl-3.0.html)
* **Copyright**: © Lucas Garron and Cubing.js contributors
* **Website / Upstream**: [https://js.cubing.net/cubing/](https://js.cubing.net/cubing/) · [GitHub](https://github.com/cubing/cubing.js)
* **Bundled Sub-Components**:
  - **twips WebAssembly Crates**: 101 Rust crates compiled to WebAssembly (governed by Apache-2.0, MIT, BSD-3-Clause, Unicode-DFS-2016). Complete crate inventory, upstream commits, and source hashes are preserved in `licenses/cubing/twips-crate-notices.json`.
  - **csTimer Solver**: GNU General Public License Version 3 (GPL-3.0). Copyright © Shuang Chen and contributors.
  - **Comlink**: Apache License 2.0. Copyright © Google LLC.
  - **random-uint-below**: MIT License.
* **Local License Artifacts**:
  - `licenses/cubing/LICENSE-MPL.md`
  - `licenses/cubing/LICENSE-GPL.md`
  - `licenses/cubing/comlink-LICENSE`
  - `licenses/cubing/csTimer-LICENSE`
  - `licenses/cubing/twips-crate-notices.json`
  - `licenses/cubing/provenance.json`

### 3.3. PuzlWerk Solvers
* **Components**: `@puzlwerk/solver-2x2` and `@puzlwerk/solver-3x3-picture`
* **License**: GNU Affero General Public License Version 3 (AGPL-3.0) / MIT / Apache-2.0
* **Copyright**: © 2026 Werner Stein and PuzlWerk contributors
* **Repository**: [https://github.com/wstein/puzlwerk](https://github.com/wstein/puzlwerk)
* **Local License Artifacts**:
  - `licenses/puzlwerk/LICENSE`
  - `licenses/puzlwerk/NOTICE`
  - `licenses/puzlwerk/COPYING`
  - `licenses/puzlwerk/provenance.json`
  - `licenses/puzlwerk/source.json`
  - `licenses/puzlwerk-picture/LICENSE`
  - `licenses/puzlwerk-picture/NOTICE`

### 3.4. ReScript Runtime
* **Component**: `@rescript/runtime` / ReScript standard library
* **License**: [MIT License](https://opensource.org/licenses/MIT)
* **Copyright**: © 2020 ReScript Association · © 2015–2020 Bloomberg Finance L.P.
* **Website / Upstream**: [https://rescript-lang.org/](https://rescript-lang.org/)

---

## 4. Typography & Font Licenses

### 4.1. Noto Sans
* **Component**: Noto Sans Latin (weights 600, 800)
* **License**: [SIL Open Font License 1.1 (OFL-1.1)](https://openfontlicense.org/)
* **Copyright**: Copyright © 2012 Google Inc. All Rights Reserved.
* **Notice**:
  ```text
  This Font Software is licensed under the SIL Open Font License, Version 1.1.
  This license is copied below, and is also available with a FAQ at:
  https://openfontlicense.org
  ```

### 4.2. DSEG (7-Segment Digital Clock Display Font)
* **Component**: DSEG7 Classic & DSEG7 Modern
* **License**: [SIL Open Font License 1.1 (OFL-1.1)](https://openfontlicense.org/)
* **Copyright**: Copyright © 2017–2020 Keshikan (keshikan.net)
* **Website**: [https://www.keshikan.net/fonts-e.html](https://www.keshikan.net/fonts-e.html)

### 4.3. IBM Plex Sans and IBM Plex Mono
* **Component**: IBM Plex Sans (400, 500, 600) and IBM Plex Mono (400, 500) as the complete, unmodified WOFF2 files from the upstream release artifacts (`fonts/complete/woff2/`): IBM Plex Sans 1.1.0 (`@ibm/plex-sans@1.1.0`, `ibm-plex-sans.zip`) and IBM Plex Mono 2.5.0 (`@ibm/plex-mono@2.5.0`, `ibm-plex-mono.zip`). Files in `public/fonts/ibm-plex/`; checksums in `public/fonts/ibm-plex/NOTICE.txt`.
* **License**: [SIL Open Font License 1.1 (OFL-1.1)](https://openfontlicense.org/); texts in `public/fonts/ibm-plex/OFL-Sans.txt` and `public/fonts/ibm-plex/OFL-Mono.txt`
* **Copyright**: Copyright © 2017 IBM Corp. with Reserved Font Name "Plex"
* **Website / Upstream**: [https://github.com/IBM/plex](https://github.com/IBM/plex)

---

## 5. Original Vector Artwork & Illustration Notices
**Picture-theme artwork licensing.** The picture themes of the playground are licensed under **CC BY-SA 4.0** (https://creativecommons.org/licenses/by-sa/4.0/, full legal code at that address), with the notice "Created by Werner Stein with AI assistance (Claude, Anthropic). Licensed under CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/). Attribution: Werner Stein, Cubistry.". The AGPL-3.0-or-later copyleft covers the program code only; these images are a separate work under CC BY-SA 4.0, and an art generator committed beside a theme is art data under the same license. Pictures that a user adds in the browser stay in that browser, are never uploaded to a server, and remain the uploader's responsibility. Entries below without a CC BY-SA 4.0 license line predate these themes.

* **Playground Artwork**: Six original vector illustrations (`F.svg`, `B.svg`, `R.svg`, `L.svg`, `U.svg`, `D.svg`) and their cropped tiles (`public/playground/NOTICE.txt`).
* **Copyright**: © 2026 Cubistry contributors.
* **License**: AGPL-3.0-or-later.
* **Regeneration**: Deterministically built using `node scripts/build-playground-art.mjs`.
* **Pastel Garden Artwork**: Six original vector illustrations and their 24 cropped SVG sticker tiles; the characters (Pip, Nimbo, Tulia, Moss, Sunny, Plop) are original inventions, not modeled on any licensed character (`public/playground-pastel/NOTICE.txt`).
* **Copyright**: © 2026 Cubistry contributors.
* **License**: AGPL-3.0-or-later.
* **Regeneration**: Deterministically built using `node scripts/build-pastel-garden-art.mjs`.
* **Four Seasons Artwork**: Six whole-face vector illustrations for the `seasons` playground theme (`public/playground-seasons/NOTICE.txt`).
* **Copyright**: © 2026 Werner Stein; created with AI assistance (Claude, Anthropic). Attribution: Werner Stein, Cubistry.
* **License**: CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/); the committed art generator is art data under the same license.
* **Regeneration**: Deterministically built using `node scripts/build-seasons-art.mjs`, then pinned with `node scripts/build-playground-theme.mjs seasons`.
* **Town Musicians Artwork**: Six whole-face vector illustrations for the `bremen` playground theme (`public/playground-bremen/NOTICE.txt`).
* **Copyright**: © 2026 Werner Stein; created with AI assistance (Claude, Anthropic). Attribution: Werner Stein, Cubistry.
* **License**: CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/); the committed art generator is art data under the same license.
* **Regeneration**: Deterministically built using `node scripts/build-bremen-art.mjs`, then pinned with `node scripts/build-playground-theme.mjs bremen`.
* **Cubistry mark and favicon**: Original marks created with Claude Design for the owner; no third-party images or fonts (`public/brand/NOTICE.txt`).
* **Copyright**: © 2026 Cubistry contributors.
* **License**: license to be decided by the owner.

---

## 6. How to Verify & Obtain Complete Corresponding Source
In compliance with the AGPL-3.0 and corresponding third-party licenses:
1. **Clone the Repository**:
   ```bash
   git clone https://github.com/wstein/cubistry.git
   cd cubistry
   ```
2. **Build and Verify All Notices**:
   ```bash
   npm ci
   npm run build
   node --test tests/runtime-notices.test.mjs
   ```
3. **Inspect Output Directory**:
   All bundled runtime licenses, provenance hashes, and source manifests are copied into `dist/licenses/` during the build step.

