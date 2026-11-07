/** The Appearance panel a studio mode extends: inside the host when it floats there, otherwise the panel docked in
 * the region the host names (`data-appearance-dock`). A panel element passed as the container finds nothing. */
export function findAppearancePanel(container: ParentNode & { dataset?: DOMStringMap }, doc: Pick<Document, "querySelector">): HTMLElement | null {
  const inside = container.querySelector(".cube-appearance") as HTMLElement | null;
  if (inside) return inside;
  const region = container.dataset?.appearanceDock;
  return region ? doc.querySelector(`[data-region="${region}"] .cube-appearance`) as HTMLElement | null : null;
}
