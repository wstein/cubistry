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
  fonts: readonly any[] = [],
  documents: readonly any[] = [],
): AssetManifest {
  const family = resolveLetterFamily(letterFont, display);
  const letterImages = hsmImagesForFamily(lettering, family) as readonly ImageAsset[];
  const digitImages = tenthAssetImages(display, marker, baseImages);
  const fontTenthWord = letterImages.find((i) => i.id === "T");
  const images = fontTenthWord
    ? digitImages.map((img) => (img.id === "T" ? fontTenthWord : img))
    : digitImages;
  const nonDigitImages = baseImages.filter(
    (img) => !/^[0-9]$/.test(img.id) && img.id !== "blank" && img.id !== "T",
  );
  return {
    schema: "cubistry.assets",
    version: 1,
    fonts: fonts as any,
    materials: [],
    documents: documents as any,
    images: [
      ...images,
      ...nonDigitImages,
      ...letterImages.filter((i) => ["H", "M", "S", "T"].includes(i.id)),
    ],
  };
}
