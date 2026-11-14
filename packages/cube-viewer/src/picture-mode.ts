// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * How a picture cube maps its face images onto the stickers.
 * - `projected` (default): six beamers, one per face, each project that face's own image face-on onto its own face; only the
 *   stickers carry it (projected-uv.ts). One texture per face, per-sticker UV windows, no prerendered tiles.
 * - `per-sticker`: the historical mapping, every sticker shows its own tile image (the viewer's `configure` assets).
 */
export type PictureMode = "projected" | "per-sticker";
export const PICTURE_MODES: readonly PictureMode[] = ["projected", "per-sticker"];
export const DEFAULT_PICTURE_MODE: PictureMode = "projected";
/** URL parameter of the picture cube apps that names the mode explicitly (`?pictures=per-sticker`). */
export const PICTURES_PARAM = "pictures";
export const PICTURE_MODE_LABEL: Readonly<Record<PictureMode, string>> = Object.freeze({ projected: "Projected", "per-sticker": "Per sticker" });
export const PICTURE_MODE_HELP: Readonly<Record<PictureMode, string>> = Object.freeze({
  projected: "Image projected across each face; only stickers carry it.",
  "per-sticker": "Each sticker shows its own tile of the face image.",
});

/** The mode named by a URL value or a stored value; anything else is no choice. */
export function parsePictureMode(raw: unknown): PictureMode | undefined {
  if (typeof raw !== "string") return undefined;
  const value = raw.toLowerCase();
  return PICTURE_MODES.find((mode) => mode === value);
}

/**
 * Migration rule: only a case without any explicit choice gets the default (Projected). An explicit URL value wins over an
 * explicit stored choice; both win over the default. Settings and links that never named a mode have no choice.
 */
export const effectivePictureMode = (explicit: { readonly url?: PictureMode; readonly stored?: PictureMode }): PictureMode =>
  explicit.url ?? explicit.stored ?? DEFAULT_PICTURE_MODE;
