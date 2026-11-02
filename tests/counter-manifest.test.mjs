import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { tenthAssetImages } from "../src/apps/ms-timer/tenth.ts";

test("Counter 0–99 manifest preserves title stickers, fonts, and documents", () => {
  const counterDesign = JSON.parse(
    readFileSync(resolve("public/counter-design.v2.json"), "utf8"),
  );
  const baseImages = counterDesign.assets.images;
  const digitImages = tenthAssetImages("dseg7", "off", baseImages);
  const nonDigitImages = baseImages.filter(
    (img) => !/^[0-9]$/.test(img.id) && img.id !== "blank" && img.id !== "T",
  );

  const manifest = {
    ...counterDesign.assets,
    images: [...digitImages, ...nonDigitImages],
  };

  // Must retain title-left and title-right for COUNTER print stickers
  assert(manifest.images.some((img) => img.id === "title-left"));
  assert(manifest.images.some((img) => img.id === "title-right"));
  assert.equal(manifest.documents.length, counterDesign.assets.documents.length);
  assert.equal(manifest.fonts.length, counterDesign.assets.fonts.length);

  // All stickers on both padded and unpadded prints must resolve
  for (const print of Object.values(counterDesign.prints)) {
    for (const sticker of print.stickers) {
      assert(
        manifest.images.some((img) => img.id === sticker.assetId),
        `Sticker assetId ${sticker.assetId} must exist in manifest`,
      );
    }
  }
});
