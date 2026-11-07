/** Header "Appearance" disclosure button. It opens and closes the docked Appearance section of the right-hand pane
 * (installed by `installAppearanceControls`) and mirrors its state. A full View menu replaces it later. */
export function installAppearanceButton(doc: Document = document): void {
  const button = doc.getElementById("appearance-btn");
  if (!button) return;
  const panel = () => doc.querySelector(".cube-appearance.is-docked");
  button.addEventListener("click", () => {
    const open = button.getAttribute("aria-expanded") === "true";
    panel()?.dispatchEvent(new CustomEvent(open ? "cube-appearance:close" : "cube-appearance:open", { detail: { opener: button } }));
  });
  // Hidden (and without aria-controls) while the active mode has no docked panel.
  const show = (open: boolean, present: boolean) => {
    button.setAttribute("aria-expanded", String(open)); button.hidden = !present;
    if (present) button.setAttribute("aria-controls", "cube-appearance-body"); else button.removeAttribute("aria-controls");
  };
  show(false, panel() !== null);
  doc.addEventListener("cube-appearance:state", (event) => {
    const { open, present } = (event as CustomEvent).detail;
    show(open, present);
  });
}
