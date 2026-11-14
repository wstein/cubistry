// SPDX-License-Identifier: AGPL-3.0-or-later
// The whole face images of the two built-in designs that are not registered themes ("picture" and "pastel"). Their tiles
// (picture-assets.ts, pastel-assets.ts) are cut from these files; the Projected picture mode needs the whole faces.
// tests/playground-faces.test.mjs checks the hashes against the files in public/.
import type { FaceSet } from "./themes.ts";

const face = (dir: string, id: string, sha256: string) => ({ url: `/${dir}/${id}.svg`, format: "svg" as const, sha256, size: 320 });

export const pictureFaces: FaceSet["faces"] = {
  F: face("playground", "F", "3454d5f0e1c9e9f0e98b32365f5fd514b5d2eba1135658cbc98410f589d263d1"),
  B: face("playground", "B", "8811b8c743f9f81c88461d65d8d64dc03e7167cc92e6af673dd39d1cf68f5fe0"),
  R: face("playground", "R", "752237add63028f759bbd28d36fbcedfb631d7f184f863b9724b94bbcd979189"),
  L: face("playground", "L", "0f0f5742e331c50b2175c9835e544611ea75f7560b6e1faf05ddcc159fcecbf4"),
  U: face("playground", "U", "60bfa5f9abd1d9b0781bd32d6aece0cf73a2b3d6fe0d9f77bb9b8174302a6033"),
  D: face("playground", "D", "634b40cde61a372842a63ede4cf7743e52a5eaaf351e8ef69341efa00b219934"),
};
export const pastelFaces: FaceSet["faces"] = {
  F: face("playground-pastel", "F", "327b8700b8110546841a525dfcfe387bbd553f810a78619f6d50c121d6039da5"),
  B: face("playground-pastel", "B", "5f296f55120bdf24e666723f5c80e453b1227ef19c9ae24b6c8b23fd40b4c87b"),
  R: face("playground-pastel", "R", "beec2bce7e44af43a94eb6f5476bc8a38dc3b6086f4c87d6017a3bad0eec485a"),
  L: face("playground-pastel", "L", "31f6bc5000072686f4f441b21c3767c5fc18b3e1f54fa3063936948059a0a143"),
  U: face("playground-pastel", "U", "8a3548799b75b50991bfedebe4835b06c0c6628d5ffa3638b354c4da68038219"),
  D: face("playground-pastel", "D", "5ab2b006c698ca111301844219ef5df292bebbd37ab705b98d2b1a26adca6142"),
};
