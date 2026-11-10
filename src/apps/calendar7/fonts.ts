// SPDX-License-Identifier: AGPL-3.0-or-later
/** Finite, locally licensed font choices. A digit pair always has one source. */
export interface FontStyle {
  readonly id: string;
  readonly label: string;
  readonly weight: number;
  readonly master: "6" | "9";
  readonly path: string;
  readonly sha256: string;
  readonly variationSettings: string;
}
export const FONT_STYLES: readonly FontStyle[] = [
  {
    "id": "noto",
    "label": "Noto Sans",
    "weight": 600,
    "master": "6",
    "path": "fonts/noto-sans-latin-600.woff2",
    "sha256": "79e274470d1c5a0118eb325e2ea6f2eb2a449336d7fde1a4f20a2f32fe1119ed",
    "variationSettings": "normal"
  },
  {
    "id": "nunito",
    "label": "Nunito",
    "weight": 600,
    "master": "6",
    "path": "fonts/calendar7/nunito.ttf",
    "sha256": "bb55a5ca5c2042335b3991af27c4d0705d0ef41cac6164ac737fd8f2a1e85207",
    "variationSettings": "\"wght\" 600"
  },
  {
    "id": "nunito-sans",
    "label": "Nunito Sans",
    "weight": 600,
    "master": "9",
    "path": "fonts/calendar7/nunito-sans.ttf",
    "sha256": "f934d7142fb4784bf828da485b7dcbd90c0c80d514e9d49a5da0ed3a1ae2491d",
    "variationSettings": "\"wght\" 600, \"wdth\" 100, \"opsz\" 12, \"YTLC\" 500"
  },
  {
    "id": "quicksand",
    "label": "Quicksand",
    "weight": 600,
    "master": "6",
    "path": "fonts/calendar7/quicksand.ttf",
    "sha256": "39c9b64223561f56aaff6062a6f04063c4fc86809ad6768722c06614d977e1cc",
    "variationSettings": "\"wght\" 600"
  },
  {
    "id": "nova-oval",
    "label": "Nova Oval",
    "weight": 400,
    "master": "9",
    "path": "fonts/calendar7/nova-oval.ttf",
    "sha256": "2ae90689c17afdcb69fd45325fc65cd98ca8d537a63ed2c33eed9827ac6a16f6",
    "variationSettings": "normal"
  },
  {
    "id": "nova-square",
    "label": "Nova Square",
    "weight": 400,
    "master": "6",
    "path": "fonts/calendar7/nova-square.ttf",
    "sha256": "bf7d8725e2fed1984cadbcb4e54d67cd898f042e11c14e9c30074b14dab6963f",
    "variationSettings": "normal"
  },
  {
    "id": "nova-mono",
    "label": "Nova Mono",
    "weight": 400,
    "master": "9",
    "path": "fonts/calendar7/nova-mono.ttf",
    "sha256": "648eadb6648c0801b186d3dcef60ee6aa84a791b1e09c726935c0712508b4807",
    "variationSettings": "normal"
  },
  {
    "id": "comfortaa",
    "label": "Comfortaa",
    "weight": 600,
    "master": "6",
    "path": "fonts/calendar7/comfortaa.ttf",
    "sha256": "0fc3f45dc48b614db9c39181502544b37217ecbf8bee2fb35886992bc96c5bd3",
    "variationSettings": "\"wght\" 600"
  },
  {
    "id": "varela-round",
    "label": "Varela Round",
    "weight": 400,
    "master": "9",
    "path": "fonts/calendar7/varela-round.ttf",
    "sha256": "e1e47eb66dbc2ddc106661338e712d9176c9e83c669a82fde155324823d03aa2",
    "variationSettings": "normal"
  },
  {
    "id": "crete-round",
    "label": "Crete Round",
    "weight": 400,
    "master": "6",
    "path": "fonts/calendar7/crete-round.ttf",
    "sha256": "2b06ee75c35806b9fab35e054fbb97af98fb6b2419c6105697351dc1a2b306c8",
    "variationSettings": "normal"
  },
  {
    "id": "dseg14classic-bold",
    "label": "DSEG14Classic Bold",
    "weight": 700,
    "master": "6",
    "path": "fonts/calendar7/dseg14classic-bold.ttf",
    "sha256": "10755549540ea735001907ee25344443ff3ee613594fb063bb5cb55d7bc85935",
    "variationSettings": "normal"
  },
  {
    "id": "dseg14classic-regular",
    "label": "DSEG14Classic Regular",
    "weight": 400,
    "master": "6",
    "path": "fonts/calendar7/dseg14classic-regular.ttf",
    "sha256": "0106818dd2e2c9ac9c6b5b7edbbe193df367397d48a18377a58090b00580d4e6",
    "variationSettings": "normal"
  },
  {
    "id": "dseg14modern-bold",
    "label": "DSEG14Modern Bold",
    "weight": 700,
    "master": "6",
    "path": "fonts/calendar7/dseg14modern-bold.ttf",
    "sha256": "b7face6ea76eac5b6945936ef7b0ead725b442c800c348317972b1fef62d9404",
    "variationSettings": "normal"
  },
  {
    "id": "dseg14modern-regular",
    "label": "DSEG14Modern Regular",
    "weight": 400,
    "master": "6",
    "path": "fonts/calendar7/dseg14modern-regular.ttf",
    "sha256": "db3925a0dc62d639ea6e0d7e4062e36e6970393a13332e0670cae27d834b65e8",
    "variationSettings": "normal"
  }
];
export const fontStyleById = (id: string | null | undefined): FontStyle => FONT_STYLES.find(f => f.id === id) ?? FONT_STYLES[0];
export interface GlyphMetric {
  readonly advance: number;
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}
export interface LoadedFont {
  readonly style: FontStyle;
  readonly family: string;
  readonly glyphs: Readonly<Record<string, GlyphMetric>>;
  readonly dateSize: number;
}
export interface GlyphRun {
  readonly input: string;
  readonly text: string;
  readonly turn: number;
  readonly x: number;
  readonly metric: GlyphMetric;
}
/** Ink bounds about a common center; all dates use the same size for one font. */
export function numberLayout(text: string, font: LoadedFont, size = font.dateSize): { runs: readonly GlyphRun[]; width: number; height: number } {
  const runs: GlyphRun[] = [];
  let advance = 0, left = Infinity, right = -Infinity, height = 0;
  for (const input of text) {
    const paired = input === "6" || input === "9";
    const source = paired ? font.style.master : input;
    const metric = font.glyphs[source];
    if (!metric) throw new Error(`Unsupported calendar glyph: ${input}`);
    const width = (metric.right - metric.left) * size;
    const x = advance + metric.advance * size / 2;
    runs.push({ input, text: source, turn: paired && input !== source ? Math.PI : 0, x, metric });
    left = Math.min(left, x - width / 2);
    right = Math.max(right, x + width / 2);
    height = Math.max(height, (metric.bottom - metric.top) * size);
    advance += metric.advance * size;
  }
  const center = (left + right) / 2;
  return { runs: runs.map(r => ({ ...r, x: r.x - center })), width: right - left, height };
}

/** Only the latest selection may paint; stale success/failure and disposal are inert. */
export class FontSelection {
  private generation = 0;
  private disposed = false;
  private readonly load: (id: string) => Promise<LoadedFont>;
  private readonly apply: (font: LoadedFont) => void;
  private readonly status: (message: string) => void;
  constructor(load: (id: string) => Promise<LoadedFont>, apply: (font: LoadedFont) => void, status: (message: string) => void) { this.load = load; this.apply = apply; this.status = status; }
  async choose(id: string): Promise<void> {
    if (this.disposed) return;
    const generation = ++this.generation;
    const current = (): boolean => !this.disposed && generation === this.generation;
    const style = fontStyleById(id);
    this.status(`Loading ${style.label}…`);
    try {
      const font = await this.load(style.id);
      if (!current()) return;
      this.apply(font);
      this.status("");
    } catch {
      if (!current()) return;
      try {
        const fallback = await this.load("noto");
        if (!current()) return;
        this.apply(fallback);
        this.status(`Could not load ${style.label}. Using Noto Sans.`);
      } catch {
        if (current()) this.status("Calendar fonts could not load. The accessible text remains available; reload to retry.");
      }
    }
  }
  dispose(): void { this.disposed = true; ++this.generation; }
}

/** A bounded cache of verified FontFace objects; only chosen styles are fetched. */
const loaded = new Map<string, Promise<LoadedFont>>();
export function loadCalendarFont(id: string, base: string): Promise<LoadedFont> {
  const style = fontStyleById(id), key = new URL(style.path, new URL(base, document.baseURI)).href;
  const existing = loaded.get(key);
  if (existing) return existing;
  const pending = loadFont(style, key).catch(error => { loaded.delete(key); throw error; });
  loaded.set(key, pending);
  return pending;
}
async function loadFont(style: FontStyle, url: string): Promise<LoadedFont> {
  const abort = new AbortController();
  const timeout = setTimeout(() => abort.abort(), 10000);
  let face: FontFace | null = null;
  try {
    const response = await fetch(url, { signal: abort.signal });
    if (!response.ok) throw new Error(`Font HTTP ${response.status}`);
    const bytes = await response.arrayBuffer();
    const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map(b => b.toString(16).padStart(2, "0")).join("");
    if (hash !== style.sha256) throw new Error("Calendar font checksum differs");
    const family = `Calendar7_${hash.slice(0, 16)}`;
    if (abort.signal.aborted) throw new Error("Calendar font load timed out");
    face = new FontFace(family, bytes, { weight: String(style.weight), style: "normal" });
    const ready = await Promise.race([face.load(), new Promise<never>((_resolve, reject) => abort.signal.addEventListener("abort", () => reject(new Error("Calendar font load timed out")), { once: true }))]);
    if (abort.signal.aborted || ready.status !== "loaded") throw new Error("Calendar font not ready");
    document.fonts.add(ready);
    const ctx = document.createElement("canvas").getContext("2d");
    if (!ctx) throw new Error("Calendar font measurement unavailable");
    ctx.font = `${style.weight} 1000px "${family}"`;
    ctx.fontKerning = "none";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    const glyphs: Record<string, GlyphMetric> = {};
    for (const c of "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
      const m = ctx.measureText(c);
      const metric = { advance: m.width / 1000, left: -m.actualBoundingBoxLeft / 1000, right: m.actualBoundingBoxRight / 1000, top: -m.actualBoundingBoxAscent / 1000, bottom: m.actualBoundingBoxDescent / 1000 };
      if (![metric.advance, metric.left, metric.right, metric.top, metric.bottom].every(Number.isFinite) || metric.right <= metric.left || metric.bottom <= metric.top) throw new Error(`Empty calendar glyph: ${c}`);
      glyphs[c] = metric;
    }
    const digitHeight = Math.max(..."0123456789".split("").map(c => glyphs[c].bottom - glyphs[c].top));
    return Object.freeze({ style, family, glyphs: Object.freeze(glyphs), dateSize: 82 / digitHeight });
  } catch (error) {
    if (face) document.fonts.delete(face);
    throw error;
  } finally { clearTimeout(timeout); }
}
