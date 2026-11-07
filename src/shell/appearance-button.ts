/** Header "Appearance" disclosure button. It opens and closes the docked Appearance section of the right-hand pane
 * (installed by `installAppearanceControls`) and mirrors its state. A full View menu replaces it later. */
export function installAppearanceButton(doc: Document = document): void {
  const button = doc.getElementById("appearance-btn");
  if (!button) return;
  button.setAttribute("aria-controls", "cube-appearance-body");
  const panel = () => doc.querySelector(".cube-appearance.is-docked");
  button.addEventListener("click", () => {
    const open = button.getAttribute("aria-expanded") === "true";
    panel()?.dispatchEvent(new CustomEvent(open ? "cube-appearance:close" : "cube-appearance:open", { detail: { opener: button } }));
  });
  doc.addEventListener("cube-appearance:state", (event) => {
    button.setAttribute("aria-expanded", String((event as CustomEvent).detail.open));
  });
}
