import type { Sticker } from "./model.ts";
/** Shared immutable sticker artwork for vector exports and WebGL texture previews. */
export function stickerArt(s: Pick<Sticker, "image" | "slot">): {
  color: string;
  size: number;
  weight: 600 | 800;
} {
  const weekend = s.slot === 0 && ["SAT", "SUN"].includes(s.image);
  return {
    weight: weekend ? 800 : 600,
    color: weekend
      ? "#ba302c"
      : /^[0-9]$/.test(s.image)
        ? "#315d4e"
        : s.slot < 3
          ? "#25343e"
          : "#925a32",
    size: s.image.length === 3 ? 82 : s.image.length === 2 ? 112 : 168,
  };
}
export function stickerSvg(
  s: Pick<Sticker, "image" | "slot">,
  fontData: Readonly<Record<600 | 800, string>>,
): string {
  const { color, size, weight } = stickerArt(s);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="14mm" height="14mm" viewBox="0 0 256 256"><defs><style>@font-face{font-family:Calendar;src:url(data:font/woff2;base64,${fontData[weight]}) format('woff2');font-weight:${weight}}</style></defs><rect width="256" height="256" fill="#fffdf6"/><text x="128" y="133" text-anchor="middle" dominant-baseline="central" font-family="Calendar" font-weight="${weight}" font-size="${size}" fill="${color}">${s.image}</text></svg>`;
}
