// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * How a picture cube maps its face images. The three valid looks:
 * - Stickered, not projected (`per-sticker`): every sticker shows its own tile image (the viewer's `configure` assets).
 * - Stickered, projected (`projected`, default): six beamers, one per face, each project that face's own image face-on onto
 *   its own face, edge to edge; only the stickers carry it (projected-uv.ts). One texture per face, per-sticker UV windows.
 * - Stickerless: always projected; the body faces carry the image, only seams and bevels stay plastic.
 * The menu is two checkboxes, Stickerless and Projected (checked and disabled while Stickerless is checked).
 */
export type PictureMode = "projected" | "per-sticker";
export const PICTURE_MODES: readonly PictureMode[] = ["projected", "per-sticker"];
export const DEFAULT_PICTURE_MODE: PictureMode = "projected";
/** URL parameter of the picture cube apps that names the mode explicitly (`?pictures=per-sticker`). */
export const PICTURES_PARAM = "pictures";
export const PROJECTED_HELP = "Image projected across each face; only stickers carry it.";

/** The mode named by a URL value or a stored value; anything else is no choice. */
export function parsePictureMode(raw: unknown): PictureMode | undefined {
  if (typeof raw !== "string") return undefined;
  const value = raw.toLowerCase();
  return PICTURE_MODES.find((mode) => mode === value);
}

/**
 * Migration rule, stored settings and links stay valid as they are: a stickerless construction is always projected (the
 * stored or URL mode does not matter). Otherwise only a case without any explicit choice gets the default (Projected); an
 * explicit URL value wins over an explicit stored choice, an explicit stored `per-sticker` stays per-sticker.
 */
export const effectivePictureMode = (explicit: { readonly url?: PictureMode; readonly stored?: PictureMode; readonly construction?: "stickered" | "stickerless" }): PictureMode =>
  explicit.construction === "stickerless" ? "projected" : explicit.url ?? explicit.stored ?? DEFAULT_PICTURE_MODE;
