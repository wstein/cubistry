// The playground's "Pictures" panel: the live suitability display, picture upload (six faces by file
// name, one cross-layout net, or drag-and-drop onto face slots) and the blank net template. It owns
// the panel's DOM and the upload state; playground.mjs only learns about a finished upload (an
// ordinary FaceSet plus its in-memory bytes) or its removal through `useUpload`, which reports whether
// the pictures could be loaded. A new set replaces the slots only after it has loaded, so a failed
// upload changes nothing. All content shown here is written with textContent/attributes and canvas
// drawing, never innerHTML, and no file name or file content is ever interpreted as markup.
import { createDesign, UPLOAD_STYLE, type Style } from "./model.ts";
import { FACE_IDS, MAX_CUBE_SIZE, MIN_CUBE_SIZE, THEMES, type FaceId, type FaceSet } from "./themes.ts";
import {
  assignFilesByName,
  buildUploadedFaceSet,
  checkSelection,
  faceOfFileName,
  minFaceResolution,
  resolutionHint,
  type PreparedFace,
  type UploadedFaceSet,
} from "./upload.ts";
import { prepareFace, prepareNet, renderSvgToPng, saveBlob } from "./upload-browser.ts";
import { netTemplateSvg, templateSize } from "./template.ts";
import {
  SAMPLE,
  analyzeStickers,
  describeSuitability,
  describeSymmetry,
  type ProblemKind,
  type Suitability,
} from "./suitability.ts";
import { measureFaceSet, renderStickers, type RenderedSticker } from "./suitability-browser.ts";

export type UseUploadResult = { readonly ok: true } | { readonly ok: false; readonly error: string };

export interface PicturesHooks {
  readonly baseUrl: string;
  /**
   * Called with a finished upload, or null when the user removes it. Resolves when the pictures are
   * loaded as a design (ok) or could not be (error); in the latter case nothing has changed.
   */
  readonly useUpload: (upload: UploadedFaceSet | null) => Promise<UseUploadResult> | UseUploadResult;
}

/** Short mark under a thumbnail, and the sentence for screen readers. */
const KIND_MARK: Record<ProblemKind, string> = {
  flat: "flat",
  identical: "same",
  symmetric4: "4-fold",
  symmetric2: "2-fold",
  twin: "twin",
};
const KIND_TEXT: Record<ProblemKind, string> = {
  flat: "mostly one flat color",
  identical: "identical to another sticker",
  symmetric4: "looks the same turned 90 degrees",
  symmetric2: "looks the same turned 180 degrees",
  twin: "a turned copy of another sticker",
};
const LIGHT_TEXT = {
  green: "Good fit.",
  yellow: "Usable; some flat stickers.",
  red: "Hard to place; many flat stickers or a flat face.",
} as const;
const MAX_THUMBS = 24;

type Slot = { face: PreparedFace; preview: string; name: string } | null;
type Incoming = Partial<Record<FaceId, { face: PreparedFace; name: string }>>;
interface Measured {
  readonly result: Suitability;
  readonly thumbs: ReadonlyMap<string, Uint8ClampedArray>;
}

export function initPictures(hooks: PicturesHooks) {
  const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
  const details = el<HTMLDetailsElement>("pictures"),
    sizeSelect = el<HTMLSelectElement>("picture-size"),
    fit = el("fit"),
    fitSummary = el("fit-summary"),
    fitSymmetry = el("fit-symmetry"),
    fitNote = el("fit-note"),
    fitThumbs = el("fit-thumbs"),
    input = el<HTMLInputElement>("upload-input"),
    slotInput = el<HTMLInputElement>("slot-input"),
    net = el("upload-net"),
    status = el("upload-status"),
    resolution = el("upload-resolution"),
    clear = el<HTMLButtonElement>("upload-clear"),
    templateNote = el("template-note"),
    live = el("pictures-live");
  const slots: Record<FaceId, Slot> = { F: null, B: null, R: null, L: null, U: null, D: null };
  const slotButton = (f: FaceId) => net.querySelector<HTMLButtonElement>(`[data-face="${f}"]`)!;
  let style: Style = "picture",
    upload: UploadedFaceSet | null = null,
    version = 0,
    fitRequest = 0,
    queue: Promise<void> = Promise.resolve();
  const cache = new Map<string, Measured>();
  const cacheKey = (n: number) => `${style === UPLOAD_STYLE ? `upload:${version}` : style}:${n}`;

  // One polite live region for the whole panel, so simultaneous updates are announced once and in order.
  const announce = (text: string) => {
    live.textContent = "";
    setTimeout(() => (live.textContent = text), 50);
  };
  const say = (text: string, tone: "info" | "warn" | "error" = "info") => {
    status.textContent = text;
    status.dataset.tone = tone;
    announce(text);
  };

  // --- Slots ------------------------------------------------------------------------------------
  function paintSlot(f: FaceId) {
    const b = slotButton(f),
      slot = slots[f];
    b.replaceChildren();
    const label = document.createElement("span");
    label.className = "slot-label";
    label.textContent = f;
    b.append(label);
    if (slot) {
      const img = document.createElement("img");
      img.alt = "";
      img.src = slot.preview;
      b.append(img);
    }
    b.dataset.filled = String(Boolean(slot));
    b.setAttribute(
      "aria-label",
      `Face ${f}: ${slot ? slot.name : "empty"}. Press Enter to choose a file, or drop one here.`,
    );
  }
  function previewOf(face: PreparedFace): string {
    return URL.createObjectURL(
      new Blob([new Uint8Array(face.bytes).buffer], { type: face.format === "png" ? "image/png" : "image/svg+xml" }),
    );
  }
  function setSlot(f: FaceId, face: PreparedFace, name: string) {
    if (slots[f]) URL.revokeObjectURL(slots[f]!.preview);
    slots[f] = { face, preview: previewOf(face), name };
    paintSlot(f);
  }
  function clearSlots() {
    for (const f of FACE_IDS) {
      if (slots[f]) URL.revokeObjectURL(slots[f]!.preview);
      slots[f] = null;
      paintSlot(f);
    }
  }
  FACE_IDS.forEach(paintSlot);

  // --- Resolution hint: warn when an uploaded PNG face is too small -----------------------------
  function paintResolution() {
    const n = Number(sizeSelect.value);
    resolution.dataset.tone = "info";
    if (!upload) {
      resolution.textContent = `A PNG face should have at least 100 pixels per sticker: ${minFaceResolution(2)} px for 2×2 up to ${minFaceResolution(7)} px for 7×7. SVG faces have no such limit.`;
      return;
    }
    const hint = resolutionHint(n, upload.faces);
    const anyPng = FACE_IDS.some((f) => upload!.faces[f].format === "png");
    if (!anyPng) resolution.textContent = "SVG faces scale without limit.";
    else if (hint.ok)
      resolution.textContent = `Cube size ${n} needs at least ${hint.required} px per face (100 px per sticker). Your PNG faces are large enough.`;
    else {
      resolution.dataset.tone = "warn";
      resolution.textContent = `Cube size ${n} needs at least ${hint.required} px per face (100 px per sticker). Too small: ${hint.small
        .map((s) => `${s.face} is ${s.size} px`)
        .join(", ")}. The stickers will look soft.`;
    }
  }

  // --- Upload -----------------------------------------------------------------------------------
  /**
   * Merges the incoming faces with the current slots. Six faces: build the set, load it and only when that
   * works replace the slots; a failure leaves slots and the active design exactly as they were. Fewer
   * than six: the slots keep what is ready so far.
   */
  async function commit(incoming: Incoming, notes: string[]) {
    const merged = FACE_IDS.map((f) => incoming[f] ?? (slots[f] ? { face: slots[f]!.face, name: slots[f]!.name } : null));
    const missing = FACE_IDS.filter((_, i) => !merged[i]);
    const apply = () => {
      for (const f of FACE_IDS) if (incoming[f]) setSlot(f, incoming[f]!.face, incoming[f]!.name);
    };
    if (missing.length) {
      apply();
      clear.hidden = !FACE_IDS.some((f) => slots[f]) && !upload;
      say([`${FACE_IDS.length - missing.length} of 6 faces ready. Missing: ${missing.join(", ")}.`, ...notes].join(" "), notes.length ? "warn" : "info");
      return;
    }
    const faces = Object.fromEntries(FACE_IDS.map((f, i) => [f, merged[i]!.face])) as Record<FaceId, PreparedFace>;
    const built = await buildUploadedFaceSet(faces);
    const result = await hooks.useUpload(built);
    if (!result.ok) {
      say(
        `The pictures could not be loaded: ${result.error}${upload ? " Your previous pictures are still in use." : ""}`,
        "error",
      );
      return;
    }
    apply();
    upload = built;
    version++;
    for (const key of [...cache.keys()]) if (key.startsWith("upload:")) cache.delete(key);
    clear.hidden = false;
    paintResolution();
    say(["All six faces are ready. Your pictures are loaded as a new design; history was cleared.", ...notes].join(" "), notes.length ? "warn" : "info");
    void refreshFit();
  }
  /** Reads every file first; nothing changes unless all of them are usable. */
  async function handle(files: File[], target?: FaceId) {
    const notes: string[] = [],
      incoming: Incoming = {};
    try {
      checkSelection(files);
      if (target) {
        if (files.length !== 1) throw Error("Drop or choose one file for a single face slot.");
        incoming[target] = { face: await prepareFace(files[0]), name: files[0].name };
      } else if (files.length === 1 && !faceOfFileName(files[0].name)) {
        const cut = await prepareNet(files[0]);
        if (cut.kind === "not-a-cross") {
          say(
            `${files[0].name} is ${Math.round(cut.width * 100) / 100} × ${Math.round(cut.height * 100) / 100}, not a 4:3 cross net. Choose or drop a file for each of the six face slots instead, or name six files F, B, L, R, U and D.`,
            "warn",
          );
          slotButton("U").focus();
          return;
        }
        for (const f of FACE_IDS) incoming[f] = { face: cut.faces[f], name: `${files[0].name} (${f})` };
      } else {
        const names = files.map((f) => f.name),
          assignment = assignFilesByName(names);
        if (Object.keys(assignment.byFace).length === 0)
          throw Error("Name the files F, B, L, R, U and D (for example F.png), or choose one net image.");
        for (const f of FACE_IDS) {
          const i = assignment.byFace[f];
          if (i !== undefined) incoming[f] = { face: await prepareFace(files[i]), name: files[i].name };
        }
        if (assignment.unmatched.length)
          notes.push(`Ignored: ${assignment.unmatched.map((i) => names[i]).join(", ")} (name must be F, B, L, R, U or D).`);
        if (assignment.duplicates.length)
          notes.push(`More than one file for ${assignment.duplicates.join(", ")}; the first was used.`);
      }
      await commit(incoming, notes);
    } catch (e) {
      say(e instanceof Error ? e.message : "The pictures could not be read.", "error");
    }
  }
  /** Every change of the pictures runs one after another, in the order the user made it. */
  const enqueue = (task: () => Promise<void>) => {
    queue = queue.then(task, task);
    return queue;
  };
  const enqueueFiles = (files: File[], target?: FaceId) => enqueue(() => handle(files, target));

  input.addEventListener("change", () => {
    const files = Array.from(input.files ?? []);
    input.value = "";
    if (files.length) void enqueueFiles(files);
  });
  net.addEventListener("click", (e) => {
    const b = (e.target as Element).closest<HTMLButtonElement>("[data-face]");
    if (!b) return;
    slotInput.dataset.face = b.dataset.face;
    slotInput.value = "";
    slotInput.click();
  });
  slotInput.addEventListener("change", () => {
    const f = slotInput.dataset.face as FaceId | undefined,
      files = Array.from(slotInput.files ?? []);
    slotInput.value = "";
    if (f && files.length) void enqueueFiles(files, f);
  });
  // Drag and drop: onto a slot assigns that face, anywhere else in the panel is like choosing files.
  const body = details.querySelector<HTMLElement>(".pictures-body")!;
  const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files");
  for (const type of ["dragenter", "dragover"] as const)
    body.addEventListener(type, (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
      net.querySelectorAll("[data-over]").forEach((s) => s.removeAttribute("data-over"));
      (e.target as Element).closest<HTMLElement>("[data-face]")?.setAttribute("data-over", "true");
    });
  body.addEventListener("dragleave", (e) => {
    (e.target as Element).closest<HTMLElement>("[data-face]")?.removeAttribute("data-over");
  });
  body.addEventListener("drop", (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    net.querySelectorAll("[data-over]").forEach((s) => s.removeAttribute("data-over"));
    const files = Array.from(e.dataTransfer?.files ?? []),
      slot = (e.target as Element).closest<HTMLElement>("[data-face]");
    if (files.length) void enqueueFiles(files, slot ? (slot.dataset.face as FaceId) : undefined);
  });
  clear.addEventListener("click", () =>
    enqueue(async () => {
      clearSlots();
      upload = null;
      version++;
      for (const key of [...cache.keys()]) if (key.startsWith("upload:")) cache.delete(key);
      clear.hidden = true;
      paintResolution();
      await hooks.useUpload(null);
      say("Your pictures were removed.");
      void refreshFit();
    }),
  );

  // --- Suitability display ----------------------------------------------------------------------
  function sourceNote(n: number) {
    return n > MIN_CUBE_SIZE
      ? `Cube size ${n} is not playable yet: the playground mechanics support 2×2 only. These numbers describe the pictures, not a puzzle you can turn. Advice only; nothing is blocked.`
      : "Advice only; nothing is blocked. Flat stickers are the real problem; identical or turned stickers just make the puzzle harder.";
  }
  function setFit(light: string, text: string, note = "", symmetry = "") {
    fit.dataset.light = light;
    fitSummary.textContent = text;
    fitSymmetry.textContent = symmetry;
    fitNote.textContent = note;
  }
  function paintThumbs(m: Measured | null) {
    fitThumbs.replaceChildren();
    if (!m) return;
    const shown = m.result.problems.slice(0, MAX_THUMBS);
    for (const p of shown) {
      const [face, r, c] = p.id.split("_"),
        li = document.createElement("li"),
        canvas = document.createElement("canvas"),
        cap = document.createElement("span"),
        marks = document.createElement("span"),
        full = document.createElement("span");
      canvas.width = canvas.height = SAMPLE;
      canvas.setAttribute("aria-hidden", "true");
      const data = m.thumbs.get(p.id);
      if (data) canvas.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(data), SAMPLE, SAMPLE), 0, 0);
      cap.textContent = `${face} ${Number(r) + 1}·${Number(c) + 1}`;
      cap.setAttribute("aria-hidden", "true");
      marks.className = "marks";
      marks.textContent = p.kinds.map((k) => KIND_MARK[k]).join(" ");
      marks.setAttribute("aria-hidden", "true");
      // The same information in full sentences for screen readers (the marks above are for the eye).
      full.className = "sr-only";
      full.textContent = `Face ${face}, row ${Number(r) + 1}, column ${Number(c) + 1}: ${p.kinds.map((k) => KIND_TEXT[k]).join(", ")}.`;
      li.append(canvas, cap, marks, full);
      fitThumbs.append(li);
    }
    if (m.result.problems.length > shown.length) {
      const more = document.createElement("li");
      more.className = "more";
      more.textContent = `+${m.result.problems.length - shown.length} more`;
      fitThumbs.append(more);
    }
  }
  function faceSetOf(): FaceSet | null {
    if (style === UPLOAD_STYLE) return upload?.set ?? null;
    return THEMES.find((t) => t.id === style) ?? null;
  }
  async function measure(n: number, signal: AbortSignal): Promise<Measured> {
    let rendered: RenderedSticker[], result: Suitability;
    const set = faceSetOf();
    if (set) ({ result, stickers: rendered } = await measureFaceSet(set, n, hooks.baseUrl, upload?.local, signal));
    else {
      // The fixed 2×2 tile designs (Landscape pictures, Pastel Garden).
      const tiles = createDesign(style).assets.images.filter((a) => a.kind === "image");
      rendered = await renderStickers([tiles], hooks.baseUrl, undefined, signal);
      result = analyzeStickers(rendered, n);
    }
    const byId = new Map(rendered.map((s) => [s.id, s.data] as const));
    return { result, thumbs: new Map(result.problems.map((p) => [p.id, byId.get(p.id)!] as const)) };
  }
  async function refreshFit() {
    const request = ++fitRequest;
    const n = Number(sizeSelect.value);
    fitThumbs.replaceChildren();
    if (style === "classic") return setFit("none", "Classic colors have no pictures to rate.");
    if (style === UPLOAD_STYLE && !upload) return setFit("none", "Upload six faces or a net to rate your pictures.");
    if (!faceSetOf() && n !== MIN_CUBE_SIZE)
      return setFit("none", "This design is made of fixed 2×2 tiles, so only size 2 can be measured. Choose a picture set or your own pictures for larger sizes.");
    const key = cacheKey(n);
    fit.setAttribute("aria-busy", "true");
    setFit("none", "Measuring the stickers…", sourceNote(n));
    try {
      let m = cache.get(key);
      if (!m) {
        m = await measure(n, AbortSignal.timeout(30000));
        if (key === cacheKey(n)) cache.set(key, m);
      }
      if (request !== fitRequest) return;
      const summary = `${LIGHT_TEXT[m.result.light]} ${describeSuitability(m.result)}.`;
      setFit(m.result.light, summary, sourceNote(n), `${describeSymmetry(m.result)}.`);
      paintThumbs(m);
      announce(summary);
    } catch (e) {
      if (request === fitRequest) setFit("none", `The stickers could not be measured: ${e instanceof Error ? e.message : "unknown error"}`);
    } finally {
      if (request === fitRequest) fit.setAttribute("aria-busy", "false");
    }
  }
  details.addEventListener("toggle", () => {
    if (details.open) void refreshFit();
  });

  // --- Template ---------------------------------------------------------------------------------
  function paintTemplate() {
    const n = Number(sizeSelect.value),
      { face, width, height } = templateSize(n);
    templateNote.textContent = `Blank ${n}×${n} net with the tile grid and the face labels U, L, F, R, B, D: ${width} × ${height} px, ${face} px per face (100 px per sticker). Paint on it and upload it as one net image.`;
  }
  async function download(kind: "png" | "svg") {
    const n = Number(sizeSelect.value);
    try {
      const svg = netTemplateSvg(n);
      if (kind === "svg") saveBlob(new Blob([svg], { type: "image/svg+xml" }), `cubistry-net-template-${n}x${n}.svg`);
      else {
        const { width, height } = templateSize(n);
        saveBlob(await renderSvgToPng(svg, width, height), `cubistry-net-template-${n}x${n}.png`);
      }
      paintTemplate();
      templateNote.textContent += ` Saved the ${kind.toUpperCase()}.`;
      announce(`Saved the ${kind.toUpperCase()} template.`);
    } catch (e) {
      templateNote.textContent = `The template could not be created: ${e instanceof Error ? e.message : "unknown error"}`;
      announce(templateNote.textContent);
    }
  }
  el("template-png").addEventListener("click", () => void download("png"));
  el("template-svg").addEventListener("click", () => void download("svg"));

  sizeSelect.addEventListener("change", () => {
    paintTemplate();
    paintResolution();
    if (details.open) void refreshFit();
  });
  if (!(MIN_CUBE_SIZE <= Number(sizeSelect.value) && Number(sizeSelect.value) <= MAX_CUBE_SIZE)) sizeSelect.value = "2";
  paintTemplate();
  paintResolution();

  return {
    /** The Design selection changed. */
    styleChanged(next: Style) {
      style = next;
      if (details.open) void refreshFit();
    },
    dispose() {
      for (const f of FACE_IDS) if (slots[f]) URL.revokeObjectURL(slots[f]!.preview);
    },
  };
}
