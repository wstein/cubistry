import "./style.css";
import "./print.css";
const $ = (id) => document.getElementById(id);
const base = new URL(import.meta.env.BASE_URL, location.origin);
const allowed = ["de-a", "en-3", "hsm-symbols", "hsm-words"];
let entries = [];
const url = (entry, file) =>
  new URL(`print/${entry.directory}${file}`, base).href;
function draw() {
  const choices = entries.filter((e) => e.design === $("print-design").value);
  let entry =
    choices.find((e) => String(e.sizeMm) === $("print-size").value) ??
    choices.find((e) => e.sizeMm === 16) ??
    choices[0];
  if (!entry) throw Error("No export preset for this physical print");
  $("print-size").replaceChildren(
    ...choices.map(
      (e) => new Option(`${e.sizeMm} × ${e.sizeMm} mm`, String(e.sizeMm)),
    ),
  );
  $("print-size").value = String(entry.sizeMm);
  $("print-summary").textContent =
    `${entry.copies} complete cubes · ${entry.stickerCount} stickers · ${entry.pages} A4 sheet${entry.pages === 1 ? "" : "s"}`;
  $("print-preview").src = url(entry, "artwork-1.svg");
  $("print-preview").alt =
    `${entry.design} sticker artwork, ${entry.sizeMm} mm, ${entry.copies} complete cube sets`;
  for (const [id, file] of [
    ["print-pdf", "print.pdf"],
    ["print-guide", "assembly.pdf"],
    ["print-bundle", "bundle.zip"],
    ["print-manifest", "manifest.json"],
    ["print-notes", "README.txt"],
  ]) {
    $(id).href = url(entry, file);
    $(id).download = `${entry.id}-${file}`;
  }
}
try {
  const response = await fetch(new URL("print/catalog.json", base));
  if (!response.ok) throw Error("Unable to load print presets");
  const catalog = await response.json();
  if (
    catalog.schema !== "cubistry.print-catalog" ||
    catalog.version !== 1 ||
    !Array.isArray(catalog.entries)
  )
    throw Error("Invalid print catalog");
  entries = catalog.entries;
  if (
    !entries.length ||
    !entries.every(
      (e) =>
        allowed.includes(e.design) &&
        /^[a-z0-9-]+$/.test(e.id) &&
        e.directory === e.id + "/" &&
        /^[a-z0-9-]+\/$/.test(e.directory) &&
        Number.isFinite(e.sizeMm) &&
        Number.isInteger(e.copies) &&
        e.copies > 0 &&
        e.copies <= 100 &&
        e.stickerCount === e.copies * (e.design.startsWith("hsm-") ? 24 : 54) &&
        e.files?.["print.pdf"] &&
        e.files?.["manifest.json"],
    )
  )
    throw Error("Invalid print preset");
  const chosen = new URLSearchParams(location.search).get("design");
  if (allowed.includes(chosen)) $("print-design").value = chosen;
  draw();
  for (const id of ["print-design", "print-size"]) {
    $(id).disabled = false;
    $(id).addEventListener("change", draw);
  }
} catch (error) {
  $("print-error").textContent = error.message;
  for (const id of [
    "print-pdf",
    "print-guide",
    "print-bundle",
    "print-manifest",
    "print-notes",
  ])
    $(id).hidden = true;
}
