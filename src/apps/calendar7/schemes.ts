// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Color schemes of the Calendar7 month sheet as plain role tokens. Data only: no DOM, no rendering, applied to the 3D view by
 * sticker-art.ts (`tileRoles`). Saturday and Sunday are styled identically in every scheme, so there is one weekend token set and one
 * SUN/SAT label ink, never separate Saturday and Sunday fields.
 *
 * Roles (all colors are lowercase #rrggbb):
 * - dayFill: tile fill of an ordinary day (the body of the sheet).
 * - dayInk: numerals of Monday to Friday dates.
 * - weekdayInk: the labels MON to FRI.
 * - weekendFill: tile fill of a weekend date (null when the scheme uses a tint instead).
 * - weekendInk: weekend numerals, on weekendFill or on weekendTint.
 * - weekendInkSmall: ink of the small second number of a folded weekend date (split label); equals weekendInk except in Paper
 *   Red, where #e0282c is darkened to the minimal #d5262a (4.50:1 on the tint) because the small number is not large text.
 * - weekendTint: light tint behind weekend numerals in the paper schemes (null otherwise).
 * - bandFill: fill of the month name band (null in line style).
 * - monthInk: ink of the month name, on bandFill or on dayFill.
 * - weekdayRowFill: fill of the weekday label row (null when it follows the day or weekend fill).
 * - emptyFill: fill of a day outside the month.
 * - seam: seam between tiles.
 * - lineRow1: line under the month name row (color and width in px), or null.
 * - lineRow2: line under the weekday label row, or null.
 * - sunSatInk: ink of the SUN and SAT labels.
 */
export interface SchemeLine {
  readonly color: string;
  readonly px: number;
}

/** Theme follows the cube color scheme; the other choices override its month banner shape. */
export type BannerStyle = "theme" | "rounded" | "square" | "underline" | "boxed" | "rounded-box";
export type ResolvedBannerStyle = Exclude<BannerStyle, "theme">;
type SchemeId = "paper-red" | "paper-blue" | "classic" | "solarized-light" | "gruvbox-light" | "dracula" | "monokai" | "gruvbox-dark" | "catppuccin-mocha" | "high-contrast" | "rubik-tint";
/**
 * Theme-default month banner shape per color scheme (owner decision 2026-11-12).
 * Filled, outlined and underlined banners stay distinct across the set.
 */
const THEME_BANNERS: Readonly<Record<SchemeId, ResolvedBannerStyle>> = Object.freeze({
  "paper-red": "rounded",
  "paper-blue": "underline",
  classic: "square",
  "solarized-light": "boxed",
  "gruvbox-light": "rounded-box",
  dracula: "square",
  monokai: "boxed",
  "gruvbox-dark": "rounded-box",
  "catppuccin-mocha": "rounded",
  "high-contrast": "square",
  "rubik-tint": "rounded",
});

export interface ColorScheme {
  /** Runtime artwork choice; the immutable palette tokens do not change. */
  readonly bannerStyle?: ResolvedBannerStyle;
  readonly id: string;
  readonly name: string;
  readonly kind: "light" | "dark";
  readonly style: "band" | "line";
  readonly isDefault: boolean;
  readonly source: string;
  readonly inspiredBy: string | null;
  readonly dayFill: string;
  readonly dayInk: string;
  readonly weekdayInk: string;
  readonly weekendFill: string | null;
  readonly weekendInk: string;
  readonly weekendInkSmall: string;
  readonly weekendTint: string | null;
  readonly bandFill: string | null;
  readonly monthInk: string;
  readonly weekdayRowFill: string | null;
  readonly emptyFill: string;
  readonly seam: string;
  readonly lineRow1: SchemeLine | null;
  readonly lineRow2: SchemeLine | null;
  readonly sunSatInk: string;
}

const UNCHECKED = "Hex values from memory, not checked against official sources; license check pending.";

const line = (color: string, px: number): SchemeLine => ({ color, px });

const deepFreeze = <T extends object>(value: T): T => {
  for (const v of Object.values(value)) if (v !== null && typeof v === "object") deepFreeze(v);
  return Object.freeze(value);
};

export const SCHEMES: readonly ColorScheme[] = deepFreeze([
  {
    id: "paper-red",
    name: "Paper Red",
    kind: "light",
    style: "band",
    isDefault: true,
    source: "Own design, owner-approved mock. Red band, gray weekday row, white tiles; weekend tint is 8% of the accent over white.",
    inspiredBy: null,
    dayFill: "#ffffff",
    dayInk: "#1a1a1a",
    weekdayInk: "#3a3a3a",
    weekendFill: null,
    weekendInk: "#e0282c",
    weekendInkSmall: "#d5262a",
    weekendTint: "#fdeeee",
    bandFill: "#e0282c",
    monthInk: "#ffffff",
    weekdayRowFill: "#ececec",
    emptyFill: "#ffffff",
    seam: "#d4d4d4",
    lineRow1: null,
    lineRow2: line("#e0282c", 2),
    sunSatInk: "#e0282c",
  },
  {
    id: "paper-blue",
    name: "Paper Blue",
    kind: "light",
    style: "line",
    isDefault: false,
    source: "Own design, owner-approved mock. No band: blue month name and lines on white, weekend tint behind numerals and SUN/SAT.",
    inspiredBy: null,
    dayFill: "#ffffff",
    dayInk: "#1a1a1a",
    weekdayInk: "#3a3a3a",
    weekendFill: null,
    weekendInk: "#1558d8",
    weekendInkSmall: "#1558d8",
    weekendTint: "#e3ebfa",
    bandFill: null,
    monthInk: "#1558d8",
    weekdayRowFill: null,
    emptyFill: "#ffffff",
    seam: "#d4d4d4",
    lineRow1: line("#1558d8", 3),
    lineRow2: line("#1558d8", 2),
    sunSatInk: "#1558d8",
  },
  {
    id: "classic",
    name: "Classic",
    kind: "light",
    style: "band",
    isDefault: false,
    source: "The existing sheet look: cream band, cream tiles, brick weekend. Own palette.",
    inspiredBy: null,
    dayFill: "#fffdf6",
    dayInk: "#1f2933",
    weekdayInk: "#2c4a6b",
    weekendFill: "#9e1f1a",
    weekendInk: "#ffffff",
    weekendInkSmall: "#ffffff",
    weekendTint: null,
    bandFill: "#efe2c4",
    monthInk: "#8a4a12",
    weekdayRowFill: null,
    emptyFill: "#ece7d6",
    seam: "#d6d0bf",
    lineRow1: null,
    lineRow2: null,
    sunSatInk: "#ffffff",
  },
  {
    id: "solarized-light",
    name: "Solarized Light",
    kind: "light",
    style: "band",
    isDefault: false,
    source: `${UNCHECKED} Weekday ink shifted #268bd2 to #2076b3 and weekend fill #d33682 to #c8337c to reach 4.5:1.`,
    inspiredBy: "Solarized (Ethan Schoonover)",
    dayFill: "#fdf6e3",
    dayInk: "#073642",
    weekdayInk: "#2076b3",
    weekendFill: "#c8337c",
    weekendInk: "#fdf6e3",
    weekendInkSmall: "#fdf6e3",
    weekendTint: null,
    bandFill: "#2aa198",
    monthInk: "#002b36",
    weekdayRowFill: null,
    emptyFill: "#eee8d5",
    seam: "#93a1a1",
    lineRow1: null,
    lineRow2: null,
    sunSatInk: "#fdf6e3",
  },
  {
    id: "gruvbox-light",
    name: "Gruvbox Light",
    kind: "light",
    style: "band",
    isDefault: false,
    source: UNCHECKED,
    inspiredBy: "Gruvbox (Pavel Pertsev)",
    dayFill: "#fbf1c7",
    dayInk: "#3c3836",
    weekdayInk: "#af3a03",
    weekendFill: "#076678",
    weekendInk: "#fbf1c7",
    weekendInkSmall: "#fbf1c7",
    weekendTint: null,
    bandFill: "#d79921",
    monthInk: "#282828",
    weekdayRowFill: null,
    emptyFill: "#ebdbb2",
    seam: "#bdae93",
    lineRow1: null,
    lineRow2: null,
    sunSatInk: "#fbf1c7",
  },
  {
    id: "dracula",
    name: "Dracula",
    kind: "dark",
    style: "band",
    isDefault: false,
    source: UNCHECKED,
    inspiredBy: "Dracula theme",
    dayFill: "#282a36",
    dayInk: "#f8f8f2",
    weekdayInk: "#8be9fd",
    weekendFill: "#bd93f9",
    weekendInk: "#282a36",
    weekendInkSmall: "#282a36",
    weekendTint: null,
    bandFill: "#ff79c6",
    monthInk: "#282a36",
    weekdayRowFill: null,
    emptyFill: "#1e1f29",
    seam: "#44475a",
    lineRow1: null,
    lineRow2: null,
    sunSatInk: "#282a36",
  },
  {
    id: "monokai",
    name: "Monokai",
    kind: "dark",
    style: "band",
    isDefault: false,
    source: `${UNCHECKED} The weekday line is the band orange shifted to #a76414 to reach 3:1 against the tiles.`,
    inspiredBy: "Monokai (Wimer Hazenberg)",
    dayFill: "#272822",
    dayInk: "#f8f8f2",
    weekdayInk: "#66d9ef",
    weekendFill: "#a6e22e",
    weekendInk: "#272822",
    weekendInkSmall: "#272822",
    weekendTint: null,
    bandFill: "#fd971f",
    monthInk: "#272822",
    weekdayRowFill: null,
    emptyFill: "#1c1d19",
    seam: "#49483e",
    lineRow1: null,
    lineRow2: line("#a76414", 2),
    sunSatInk: "#272822",
  },
  {
    id: "gruvbox-dark",
    name: "Gruvbox Dark",
    kind: "dark",
    style: "band",
    isDefault: false,
    source: UNCHECKED,
    inspiredBy: "Gruvbox (Pavel Pertsev)",
    dayFill: "#282828",
    dayInk: "#ebdbb2",
    weekdayInk: "#fabd2f",
    weekendFill: "#fb4934",
    weekendInk: "#1d2021",
    weekendInkSmall: "#1d2021",
    weekendTint: null,
    bandFill: "#83a598",
    monthInk: "#1d2021",
    weekdayRowFill: null,
    emptyFill: "#1d2021",
    seam: "#504945",
    lineRow1: null,
    lineRow2: null,
    sunSatInk: "#1d2021",
  },
  {
    id: "catppuccin-mocha",
    name: "Catppuccin Mocha",
    kind: "dark",
    style: "band",
    isDefault: false,
    source: UNCHECKED,
    inspiredBy: "Catppuccin Mocha",
    dayFill: "#1e1e2e",
    dayInk: "#cdd6f4",
    weekdayInk: "#b4befe",
    weekendFill: "#f38ba8",
    weekendInk: "#11111b",
    weekendInkSmall: "#11111b",
    weekendTint: null,
    bandFill: "#94e2d5",
    monthInk: "#11111b",
    weekdayRowFill: null,
    emptyFill: "#181825",
    seam: "#45475a",
    lineRow1: null,
    lineRow2: null,
    sunSatInk: "#11111b",
  },
  {
    id: "high-contrast",
    name: "High Contrast",
    kind: "dark",
    style: "band",
    isDefault: false,
    source: "Own design. Black tiles, white ink, cyan weekdays, yellow weekend, white band; empty days #2a2a2a (lighter than the mock's #161616); weekday line #828282.",
    inspiredBy: null,
    dayFill: "#000000",
    dayInk: "#ffffff",
    weekdayInk: "#00e5ff",
    weekendFill: "#ffe600",
    weekendInk: "#000000",
    weekendInkSmall: "#000000",
    weekendTint: null,
    bandFill: "#ffffff",
    monthInk: "#000000",
    weekdayRowFill: null,
    emptyFill: "#2a2a2a",
    seam: "#555555",
    lineRow1: null,
    lineRow2: line("#828282", 2),
    sunSatInk: "#000000",
  },
  {
    id: "rubik-tint",
    name: "Rubik-Tint",
    kind: "light",
    style: "band",
    isDefault: false,
    source: "Own design (owner 2026-11-12). Black print on a very light tint of the standard Rubik color of the stone's home face (home-tint.ts); black month band with white lettering; the color is a hint only. dayFill and weekendFill are the tint of the white face (no weekend shading), used where no home face is known (2D sheet).",
    inspiredBy: null,
    dayFill: "#ffffff",
    dayInk: "#111111",
    weekdayInk: "#111111",
    weekendFill: "#ffffff",
    weekendInk: "#111111",
    weekendInkSmall: "#111111",
    weekendTint: null,
    bandFill: "#111111",
    monthInk: "#ffffff",
    weekdayRowFill: null,
    emptyFill: "#ffffff",
    seam: "#d4d4d4",
    lineRow1: null,
    lineRow2: null,
    sunSatInk: "#111111",
  },
]);

/** The scheme of the app: the one marked `isDefault` (Paper Red). */
export const DEFAULT_SCHEME: ColorScheme = SCHEMES.find((s) => s.isDefault) as ColorScheme;

/** The scheme with this id; null, undefined and an unknown id give `DEFAULT_SCHEME` (never throws). */
export function schemeById(id: string | null | undefined): ColorScheme {
  return SCHEMES.find((s) => s.id === id) ?? DEFAULT_SCHEME;
}

/** Invalid URL choices use the color theme's banner default. */
export function parseBannerStyle(value: string | null | undefined): BannerStyle {
  return value === "rounded" || value === "square" || value === "underline" || value === "boxed" || value === "rounded-box" ? value : "theme";
}

/** The color theme's shape, unless this runtime copy has an explicit shape. */
export function resolvedBannerStyle(scheme: ColorScheme): ResolvedBannerStyle {
  return scheme.bannerStyle ?? (Object.hasOwn(THEME_BANNERS, scheme.id) ? THEME_BANNERS[scheme.id as SchemeId] : "rounded");
}

/** Resolve artwork without changing the frozen palette or retaining an old override in Theme mode. */
export function withBannerStyle(scheme: ColorScheme, choice: BannerStyle): ColorScheme {
  const { bannerStyle: _old, ...palette } = scheme;
  return { ...palette, bannerStyle: choice === "theme" ? resolvedBannerStyle(palette) : choice };
}

/** Readable ink for an unfilled banner, selected only from the existing palette. */
export function underlineInk(scheme: ColorScheme): string {
  const luminance = (hex: string): number => {
    const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const bg = luminance(namesGround(scheme.dayFill));
  return [scheme.monthInk, scheme.bandFill, scheme.dayInk].find(color => {
    if (!color) return false;
    const fg = luminance(color);
    return (Math.max(bg, fg) + 0.05) / (Math.min(bg, fg) + 0.05) >= 4.5;
  }) ?? scheme.dayInk;
}

/**
 * The white of the names layout: the grounds of the weekday row, the date cells and the empty days. Neutral (no warm tint)
 * and lighter than the grey #ececec of the weekday row in the standard layout.
 */
export const NAMES_WHITE = "#fdfdfd";

/** Names layout: a neutral light ground (white or light grey) becomes `NAMES_WHITE`; every other fill stays. */
export const namesGround = (fill: string): string => {
  const m = /^#([0-9a-f]{2})\1\1$/i.exec(fill);
  return m && parseInt(m[1], 16) >= 0xec ? NAMES_WHITE : fill;
};
