/** A print download chooses the actual physical print, not the displayed value. */
export function installPrintLink(design: () => string | null): void {
  const link = document.createElement("a");
  link.id = "print-stickers";
  link.textContent = "Print stickers";
  const update = () => {
    const current = design();
    link.hidden = current === null;
    const url = new URL("print.html", location.href);
    if (current) url.searchParams.set("design", current);
    link.href = url.href;
  };
  for (const event of ["click", "focus", "pointerdown", "contextmenu"])
    link.addEventListener(event, update);
  document.addEventListener("change", update, true);
  (
    document.getElementById("presentation-tools") ??
    document.querySelector("header")
  )?.append(link);
  update();
}
