import { syncDurationControl, changeDurationControl } from "./controls.ts";
import { CalendarViewer } from "../calendar/viewer.ts";
import { scramble } from "../playground/model.ts";
import { FACE_FRAMES, scrambleWord, type Face } from "./model.ts";
import { PRESETS, type Preset } from "./presets.ts";
import { bindPictureLifecycle } from "./lifecycle.ts";
import { PictureEditor } from "./editor.ts";
import { Cube3Controller } from "./controller.ts";
import { PictureStore, openPictureDatabase, type PictureSet } from "./storage.ts";
const el = <T extends HTMLElement = HTMLElement>(id: string): T => { const value = document.getElementById(id); if (!value) throw Error(`Missing control: ${id}`); return value as T; };
let disposed = false, released = false, viewer: CalendarViewer | undefined, controller: Cube3Controller | undefined;
let style: "picture" | "classic" = "picture", store: PictureStore | undefined, rows: PictureSet[] = [], storageBusy = false, rendererAttempted = false, storageEpoch = 0;
const faceLabels: Record<Face, string> = { U: "U · Up", D: "D · Down", F: "F · Front", B: "B · Back", L: "L · Left", R: "R · Right" };
const fields = new Map<Face, { preview: HTMLElement; file: HTMLInputElement; controls: HTMLInputElement[]; outputs: HTMLOutputElement[]; error: HTMLElement; reset: HTMLButtonElement }>();
const physicalButtons: HTMLButtonElement[] = [];
const editor = new PictureEditor({ changed(artworkChanged) {
  if (disposed) { releaseIfIdle(); return; }
  if (editor.ready && !rendererAttempted) initializeRenderer();
  else if (artworkChanged && controller && viewer) viewer.updateArtwork(editor.artwork(style));
  update();
} });
function report(id: string, error: unknown) { if (!disposed) el(id).textContent = error instanceof Error ? error.message : String(error); }
function initializeRenderer() {
  if (disposed || !editor.ready) return;
  rendererAttempted = true;
  try {
    viewer = new CalendarViewer(el("cube")); viewer.duration = Number(el<HTMLSelectElement>("speed").value);
    controller = new Cube3Controller(viewer, () => editor.artwork(style), update);
    el("render-error").hidden = true; el("retry-render").hidden = true;
  } catch (error) {
    if (viewer && !viewer.animating) viewer.destroy(); viewer = undefined;
    el("render-error").hidden = false; el("retry-render").hidden = false;
    report("render-error", `3D view unavailable: ${error instanceof Error ? error.message : error}. Pictures can still be edited and saved locally.`);
  }
}
function update() {
  if (disposed) { releaseIfIdle(); return; }
  viewer?.renderer.domElement.setAttribute("aria-label", `Physical 3 by 3 ${style === "picture" ? "Super Picture" : "classic color"} cube. Drag to rotate the cube.`);
  const snapshot = controller?.snapshot, blocked = !snapshot || snapshot.busy || snapshot.frozen;
  for (const button of physicalButtons) button.disabled = blocked;
  syncDurationControl(el<HTMLSelectElement>("speed"), viewer, blocked);
  el<HTMLInputElement>("notation").disabled = blocked; el<HTMLInputElement>("seed").disabled = blocked; el<HTMLInputElement>("count").disabled = blocked;
  el<HTMLButtonElement>("undo").disabled = blocked || !snapshot?.cursor;
  el<HTMLButtonElement>("redo").disabled = blocked || snapshot!.cursor >= snapshot!.history.length;
  el<HTMLButtonElement>("cancel").disabled = !snapshot?.busy;
  el<HTMLButtonElement>("reference").disabled = !viewer;
  el("cube").setAttribute("aria-busy", String(snapshot?.busy ?? !editor.ready));
  el("cube").dataset.exact = String(snapshot?.exact ?? false);
  el("exact").textContent = snapshot ? snapshot.frozen ? "Unknown" : snapshot.exact ? "Exact · centers aligned" : "Not exact" : "Unavailable";
  if (snapshot) {
    el("physical-status").textContent = snapshot.message;
    el("stats").textContent = `${snapshot.cursor} / ${snapshot.history.length} history moves · ${snapshot.turns} turns played`;
    el("history").replaceChildren(...snapshot.history.map((word, i) => { const li = document.createElement("li"); li.textContent = word; li.setAttribute("aria-label", `${i + 1}. ${word}${i >= snapshot.cursor ? " · redo available" : ""}`); return li; }));
  }
  for (const [face, field] of fields) {
    const resource = editor.faces.get(face); field.file.disabled = !editor.ready || editor.pending;
    field.reset.disabled = !resource || editor.pending;
    for (const input of field.controls) input.disabled = !resource || editor.pending;
    if (resource) {
      if (field.preview.firstChild !== resource.canvas) { resource.canvas.setAttribute("role", "img"); resource.canvas.setAttribute("aria-label", `${faceLabels[face]} cropped picture, split into nine tiles on the cube`); field.preview.replaceChildren(resource.canvas); }
      const values = [resource.crop.zoom, resource.crop.x, resource.crop.y];
      field.controls.forEach((input, i) => { input.value = String(values[i]); field.outputs[i].value = values[i].toFixed(2); input.setAttribute("aria-valuetext", values[i].toFixed(2)); });
    }
  }
  el<HTMLButtonElement>("save-set").disabled = !store || !editor.ready || editor.pending || storageBusy;
  const selected = el<HTMLSelectElement>("saved-sets").value;
  el<HTMLButtonElement>("load-set").disabled = !store || !selected || storageBusy || editor.pending;
  el<HTMLButtonElement>("delete-set").disabled = !store || !selected || storageBusy;
}
async function physical(action: () => Promise<void>) { if (disposed) return; try { await action(); } catch (error) { report("physical-status", error); } update(); }
for (const { face } of FACE_FRAMES) for (const suffix of ["", "'", "2"]) {
  const token = face + suffix, button = document.createElement("button"); button.type = "button"; button.textContent = token; button.setAttribute("aria-label", `Turn ${token}`);
  button.onclick = () => { void physical(() => controller?.play(token) ?? Promise.resolve()); }; physicalButtons.push(button); el("face-buttons").append(button);
}
for (const token of ["x", "y", "z"]) {
  const button = document.createElement("button"); button.type = "button"; button.textContent = `Whole cube ${token}`;
  button.onclick = () => { void physical(() => controller?.play(token) ?? Promise.resolve()); }; physicalButtons.push(button); el("rotations").append(button);
}
for (const id of ["solve", "restore"]) physicalButtons.push(el<HTMLButtonElement>(id));
for (const id of ["notation-form", "scramble-form"]) physicalButtons.push(el(id).querySelector<HTMLButtonElement>("button")!);
el("notation-form").onsubmit = event => { event.preventDefault(); void physical(() => controller?.play(el<HTMLInputElement>("notation").value) ?? Promise.resolve()); };
el("scramble-form").onsubmit = event => { event.preventDefault(); void physical(() => controller?.play(scrambleWord(scramble(Number(el<HTMLInputElement>("seed").value), Number(el<HTMLInputElement>("count").value))), "scramble") ?? Promise.resolve()); };
el("solve").onclick = () => { void physical(() => controller?.solve() ?? Promise.resolve()); };
el("undo").onclick = () => { void physical(() => controller?.undo() ?? Promise.resolve()); };
el("redo").onclick = () => { void physical(() => controller?.redo() ?? Promise.resolve()); };
el("cancel").onclick = () => controller?.cancel();
el("restore").onclick = () => { void physical(() => controller?.restore() ?? Promise.resolve()); };
el("reference").onclick = () => viewer?.resetReferenceView();
el("retry-render").onclick = () => { initializeRenderer(); update(); };
el("speed").onchange = () => changeDurationControl(el<HTMLSelectElement>("speed"), viewer, !controller || controller.snapshot.busy || controller.snapshot.frozen);
el("style").onchange = () => { if (disposed) return; style = el<HTMLSelectElement>("style").value === "classic" ? "classic" : "picture"; if (viewer && controller) viewer.updateArtwork(editor.artwork(style)); update(); };
for (const { face } of FACE_FRAMES) {
  const field = document.createElement("fieldset"), legend = document.createElement("legend"); legend.textContent = faceLabels[face]; field.append(legend);
  const file = document.createElement("input"); file.type = "file"; file.accept = "image/png,image/jpeg,image/webp"; file.id = `upload-${face}`;
  const label = document.createElement("label"); label.htmlFor = file.id; label.textContent = `Choose ${faceLabels[face]} image`; field.append(label, file);
  const preview = document.createElement("div"); preview.className = "face-preview"; field.append(preview);
  const controls: HTMLInputElement[] = [], outputs: HTMLOutputElement[] = [];
  for (const [key, name] of [["zoom", "Zoom"], ["x", "Horizontal position"], ["y", "Vertical position"]] as const) {
    const row = document.createElement("div"); row.className = "crop-control";
    const input = document.createElement("input"); input.type = "range"; input.id = `${key}-${face}`; input.min = key === "zoom" ? "1" : "-1"; input.max = key === "zoom" ? "4" : "1"; input.step = ".01";
    const caption = document.createElement("label"); caption.htmlFor = input.id; caption.textContent = `${name} · ${face}`;
    const output = document.createElement("output"); output.htmlFor = input.id; output.setAttribute("aria-hidden", "true"); row.append(caption, output, input); field.append(row); controls.push(input); outputs.push(output);
    input.oninput = () => { if (disposed) return; try { editor.crop(face, { zoom: Number(controls[0].value), x: Number(controls[1].value), y: Number(controls[2].value) }); el<HTMLSelectElement>("preset").value = ""; report("image-status", `${faceLabels[face]} crop updated. Puzzle state is unchanged.`); } catch (error) { report("image-status", error); } };
  }
  const error = document.createElement("p"); error.className = "face-error"; error.id = `error-${face}`; error.setAttribute("role", "alert"); file.setAttribute("aria-describedby", error.id);
  const reset = document.createElement("button"); reset.type = "button"; reset.textContent = `Reset ${face} crop`; reset.onclick = () => { if (!disposed) { editor.crop(face, { zoom: 1, x: 0, y: 0 }); el<HTMLSelectElement>("preset").value = ""; } };
  field.append(reset, error); el("face-editors").append(field); fields.set(face, { file, preview, controls, outputs, error, reset });
  file.onchange = async () => { if (disposed) return; const blob = file.files?.[0]; if (!blob) return;
    try { if (await editor.upload(face, blob)) { error.textContent = ""; el<HTMLSelectElement>("preset").value = ""; report("image-status", `${faceLabels[face]} image updated. Your pictures remain local.`); } }
    catch (reason) { if (!disposed) { error.textContent = reason instanceof Error ? reason.message : String(reason); report("image-status", `${faceLabels[face]} image unchanged. ${error.textContent}`); } }
    finally { file.value = ""; update(); }
  };
}
el("preset").onchange = async () => { const id = el<HTMLSelectElement>("preset").value; if (disposed || !PRESETS.some(p => p.id === id)) return;
  try { if (await editor.preset(id as Preset)) report("image-status", "Example set ready. Your puzzle state is unchanged."); } catch (error) { report("image-status", error); } update(); };
async function refreshLibrary() {
  if (!store || disposed) return; const active = store, result = await active.list(); if (disposed || store !== active) return; rows = result;
  const select = el<HTMLSelectElement>("saved-sets"), selected = select.value;
  select.replaceChildren(new Option("Choose a saved set", ""), ...rows.map(row => new Option(row.name, row.id))); select.value = rows.some(r => r.id === selected) ? selected : ""; update();
}
async function initializeStorage() {
  if (disposed || storageBusy) return; const epoch = ++storageEpoch; storageBusy = true; update();
  try { const database = await openPictureDatabase(); if (disposed || epoch !== storageEpoch) { database.close(); return; } store?.close(); store = new PictureStore(database); await refreshLibrary(); if (disposed || epoch !== storageEpoch) return; report("storage-status", "Local storage ready. Pictures are saved only when you choose Save."); }
  catch (error) { if (epoch === storageEpoch) report("storage-status", error); } finally { if (epoch === storageEpoch) { storageBusy = false; update(); } }
}
el("retry-storage").onclick = () => { void initializeStorage(); };
el("saved-sets").onchange = update;
el("save-form").onsubmit = async event => { event.preventDefault(); if (!store || disposed || editor.pending || storageBusy) return;
  storageBusy = true; update(); const name = el<HTMLInputElement>("set-name").value.trim(), existing = rows.find(r => r.name === name);
  try { const record: PictureSet = { version: 1, id: existing?.id ?? crypto.randomUUID(), name, updatedAt: Date.now(), faces: editor.snapshot() };
    await store.save(record); if (disposed) return; await refreshLibrary(); if (disposed) return; el<HTMLSelectElement>("saved-sets").value = record.id; report("storage-status", `Saved “${name}” on this device.`); }
  catch (error) { report("storage-status", error); } finally { storageBusy = false; update(); }
};
el("load-set").onclick = async () => { const row = rows.find(r => r.id === el<HTMLSelectElement>("saved-sets").value); if (!row || disposed || storageBusy) return;
  try { if (await editor.load(row.faces)) { el<HTMLInputElement>("set-name").value = row.name; el<HTMLSelectElement>("preset").value = ""; report("storage-status", `Loaded “${row.name}”. Puzzle state is unchanged.`); } } catch (error) { report("storage-status", error); } update(); };
el("delete-set").onclick = async () => { const row = rows.find(r => r.id === el<HTMLSelectElement>("saved-sets").value); if (!row || !store || disposed || storageBusy) return;
  storageBusy = true; update(); try { await store.delete(row.id); await refreshLibrary(); report("storage-status", `Deleted saved set “${row.name}”. Current pictures are retained.`); }
  catch (error) { report("storage-status", error); } finally { storageBusy = false; update(); } };
function releaseIfIdle() {
  if (!disposed || released || viewer?.animating) return;
  released = true; viewer?.destroy(); editor.dispose(); store?.close();
}
bindPictureLifecycle(window, {
  suspend() { storageEpoch++; store?.close(); store = undefined; storageBusy = false; },
  resume() { update(); void initializeStorage(); },
  dispose() { disposed = true; storageEpoch++; editor.cancelPending(); controller?.dispose(); releaseIfIdle(); },
});
update();
void initializeStorage();
void editor.preset("coast").then(ok => { if (ok) report("image-status", "Coastal landscapes ready. Choose your own six images or another example set."); }).catch(error => report("image-status", error));
export const picture3App = { editor, get controller() { return controller; }, get viewer() { return viewer; } };
