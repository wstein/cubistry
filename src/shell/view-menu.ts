/** Header "View" menu of the studio. Its one entry opens the Appearance section of the right-hand pane
 * (a docked, collapsed-by-default section installed by `installAppearanceControls`; nothing is remembered). */
export function installViewMenu(doc: Document = document): void {
  const button = doc.getElementById("view-menu-btn"), menu = doc.getElementById("view-menu"), item = doc.getElementById("view-menu-appearance");
  if (!button || !menu || !item) return;
  const setOpen = (open: boolean, restoreFocus = false) => {
    menu.hidden = !open; button.setAttribute("aria-expanded", String(open));
    if (open) item.focus(); else if (restoreFocus) button.focus();
  };
  button.addEventListener("click", () => setOpen(menu.hidden));
  const escape = (event: Event) => {
    if ((event as KeyboardEvent).key !== "Escape" || menu.hidden) return;
    event.preventDefault(); setOpen(false, true);
  };
  menu.addEventListener("keydown", escape); button.addEventListener("keydown", escape);
  doc.addEventListener("click", (event) => {
    const target = event.target as Node | null;
    if (!menu.hidden && target && !menu.contains(target) && !button.contains(target)) setOpen(false);
  });
  item.addEventListener("click", () => {
    setOpen(false);
    doc.querySelector(".cube-appearance.is-docked")?.dispatchEvent(new CustomEvent("cube-appearance:open", { detail: { opener: button } }));
  });
}
