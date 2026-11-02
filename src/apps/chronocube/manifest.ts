import {
  hsmImagesForFamily,
  resolveLetterFamily,
  type Lettering,
  type LetterFont,
} from "../hsm/lettering.ts";
import {
  tenthAssetImages,
  type TenthDisplayVariant,
  type TenthMarkerMode,
} from "../ms-timer/tenth.ts";
import type { AssetManifest, ImageAsset } from "@cubistry/cube-assets";

export function buildStudioManifest(
  display: TenthDisplayVariant = "dseg7",
  marker: TenthMarkerMode = "off",
  letterFont: LetterFont = "same",
  lettering: Lettering = "words-pascal",
  baseImages: readonly ImageAsset[] = [],
): AssetManifest {
  const family = resolveLetterFamily(letterFont, display);
  const letterImages = hsmImagesForFamily(lettering, family) as readonly ImageAsset[];
  const digitImages = tenthAssetImages(display, marker, baseImages);
  const fontTenthWord = letterImages.find((i) => i.id === "T");
  const images = fontTenthWord
    ? digitImages.map((img) => (img.id === "T" ? fontTenthWord : img))
    : digitImages;
  return {
    schema: "cubistry.assets",
    version: 1,
    fonts: [],
    materials: [],
    documents: [],
    images: [
      ...images,
      ...letterImages.filter((i) => ["H", "M", "S", "T"].includes(i.id)),
    ],
  };
}
