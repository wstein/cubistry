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

export const DEFAULT_STUDIO_MATERIALS = [
  { id: "plastic", color: "#202329", roughness: 0.45 },
  { id: "sticker", color: "#ffffff", roughness: 0.7 },
];

export function buildStudioManifest(
  display: TenthDisplayVariant = "dseg7",
  marker: TenthMarkerMode = "off",
  letterFont: LetterFont = "same",
  lettering: Lettering = "words-pascal",
  baseImages: readonly ImageAsset[] = [],
  fonts: readonly any[] = [],
  documents: readonly any[] = [],
  materials: readonly any[] = [],
): AssetManifest {
  const family = resolveLetterFamily(letterFont, display);
  const letterImages = hsmImagesForFamily(lettering, family) as readonly ImageAsset[];
  const digitImages = tenthAssetImages(display, marker, baseImages);
  const fontTenthWord = (hsmImagesForFamily("words-pascal", family) as readonly ImageAsset[]).find((i) => i.id === "T");
  const images = fontTenthWord
    ? digitImages.map((img) => (img.id === "T" ? fontTenthWord : img))
    : digitImages;
  const nonDigitImages = baseImages.filter(
    (img) => !/^[0-9]$/.test(img.id) && img.id !== "blank" && img.id !== "T",
  );
  const allImages = [
    ...images,
    ...nonDigitImages,
    ...letterImages.filter((i) => ["H", "M", "S"].includes(i.id)),
  ];
  const uniqueImages = Array.from(
    new Map(allImages.map((img) => [img.id, img])).values(),
  );
  return {
    schema: "cubistry.assets",
    version: 1,
    fonts: fonts as any,
    materials: (materials && materials.length > 0 ? materials : DEFAULT_STUDIO_MATERIALS) as any,
    documents: documents as any,
    images: uniqueImages,
  };
}
