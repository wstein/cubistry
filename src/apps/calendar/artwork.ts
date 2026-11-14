import type { Sticker } from "./model.ts";
import { SCHEMES, type ColorScheme } from "../calendar7/schemes.ts";

/** Label classes of a 3x3 calendar sticker. German has no weekend class: its weekday stickers are plain in every scheme. */
export type StickerRole = "day" | "weekday" | "month" | "weekend";
export interface RoleInk {
  readonly ink: string;
  readonly ground: string;
  readonly weight: 600 | 800;
}
/** Screen color scheme of the 3x3: one ground and one ink per label class. Print files never read it. */
export interface Cal3Scheme {
  readonly id: string;
  readonly name: string;
  /** Sticker ground of ordinary labels (the weekend classes carry their own ground). */
  readonly ground: string;
  readonly roles: Readonly<Record<StickerRole, RoleInk>>;
}

const PAPER = "#fffdf6";
const plain = (ink: string, weight: 600 | 800 = 600): RoleInk => ({ ink, ground: PAPER, weight });

/** The artwork of the printed cube and of the print export: unchanged since the first release. */
export const DEFAULT_CAL3_SCHEME: Cal3Scheme = Object.freeze({
  id: "default",
  name: "Default (print colors)",
  ground: PAPER,
  roles: Object.freeze({
    day: plain("#315d4e"),
    weekday: plain("#25343e"),
    month: plain("#925a32"),
    weekend: plain("#ba302c", 800),
  }),
});

/** Why a Calendar7 scheme is not offered on the 3x3. */
export const CAL3_EXCLUDED: readonly { readonly id: string; readonly reason: string }[] = Object.freeze([
  {
    id: "rubik-tint",
    reason: "Colors each stone by its home face, which comes from the identity pose of the 7x7 names data; the 3x3 print has no such pose.",
  },
]);

/** Chip overrides where the scheme's own band color is too close to its paper (Classic: band #efe2c4 on #fffdf6 is 1.26:1). */
const CHIP_OVERRIDES: Readonly<Record<string, Pick<RoleInk, "ground" | "ink">>> = {
  classic: { ground: "#d9b36a", ink: "#3d2005" },
};

function fromCalendar7(s: ColorScheme): Cal3Scheme {
  const weekend: RoleInk = { ink: s.sunSatInk, ground: s.weekendFill ?? s.weekendTint ?? s.dayFill, weight: 800 };
  const on = (ink: string): RoleInk => ({ ink, ground: s.dayFill, weight: 600 });
  // Month stickers are inverse chips: the month color as ground (the band color; line schemes use their accent) with the month ink.
  const chip: RoleInk = { ground: s.bandFill ?? s.monthInk, ink: s.bandFill ? s.monthInk : s.dayFill, weight: 600, ...CHIP_OVERRIDES[s.id] };
  return Object.freeze({
    id: s.id,
    name: s.name,
    ground: s.dayFill,
    roles: Object.freeze({ day: on(s.dayInk), weekday: on(s.weekdayInk), month: chip, weekend }),
  });
}

const excludedIds = new Set(CAL3_EXCLUDED.map((e) => e.id));
/** The default first, then every Calendar7 scheme that the 3x3 can show. */
export const CAL3_SCHEMES: readonly Cal3Scheme[] = Object.freeze([DEFAULT_CAL3_SCHEME, ...SCHEMES.filter((s) => !excludedIds.has(s.id)).map(fromCalendar7)]);

/** The scheme with this id; null, undefined and an unknown id give the default (never throws). */
export function cal3SchemeById(id: string | null | undefined): Cal3Scheme {
  return CAL3_SCHEMES.find((s) => s.id === id) ?? DEFAULT_CAL3_SCHEME;
}

/** The label class of a sticker. Only English SAT/SUN are weekend stickers. */
export function stickerRole(s: Pick<Sticker, "image" | "slot">): StickerRole {
  if (s.slot === 0 && ["SAT", "SUN"].includes(s.image)) return "weekend";
  if (/^[0-9]$/.test(s.image)) return "day";
  return s.slot < 3 ? "weekday" : "month";
}

/** Shared immutable sticker artwork for vector exports and WebGL texture previews. */
export function stickerArt(
  s: Pick<Sticker, "image" | "slot">,
  scheme: Cal3Scheme = DEFAULT_CAL3_SCHEME,
): {
  color: string;
  ground: string;
  size: number;
  weight: 600 | 800;
} {
  const r = scheme.roles[stickerRole(s)];
  return {
    weight: r.weight,
    color: r.ink,
    ground: r.ground,
    size: s.image.length === 3 ? 82 : s.image.length === 2 ? 112 : 168,
  };
}

/** Minimal 2D-context surface that `paintSticker` needs (a canvas context in the browser). */
export interface StickerContext {
  fillStyle: unknown;
  font: string;
  textAlign: unknown;
  textBaseline: unknown;
  fillRect(x: number, y: number, w: number, h: number): void;
  fillText(text: string, x: number, y: number): void;
}

/** Paints one 256 px sticker texture: ground, then the glyph. Used again on the same canvas when the scheme changes. */
export function paintSticker(ctx: StickerContext, s: Pick<Sticker, "image" | "slot">, scheme: Cal3Scheme): void {
  const art = stickerArt(s, scheme);
  ctx.fillStyle = art.ground;
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = art.color;
  ctx.font = `${art.weight} ${art.size}px "Counter Sans"`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(s.image, 128, 133);
}
export function stickerSvg(
  s: Pick<Sticker, "image" | "slot">,
  fontData: Readonly<Record<600 | 800, string>>,
): string {
  const { color, size, weight } = stickerArt(s);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="14mm" height="14mm" viewBox="0 0 256 256"><defs><style>@font-face{font-family:Calendar;src:url(data:font/woff2;base64,${fontData[weight]}) format('woff2');font-weight:${weight}}</style></defs><rect width="256" height="256" fill="#fffdf6"/><text x="128" y="133" text-anchor="middle" dominant-baseline="central" font-family="Calendar" font-weight="${weight}" font-size="${size}" fill="${color}">${s.image}</text></svg>`;
}
