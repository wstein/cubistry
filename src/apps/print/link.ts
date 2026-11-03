/** A print download chooses the actual physical print, not the displayed value. */
export function installPrintLink(design: () => string | null): void {
  const existing = document.getElementById("print-stickers") as HTMLAnchorElement | null;
  const link = existing ?? document.createElement("a");
  if (!existing) {
    link.id = "print-stickers";
    link.textContent = "Print stickers";
  } else {
    link.removeAttribute("target");
  }
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
  window.addEventListener("popstate", update);
  setInterval(update, 200);
  if (!existing) {
    (
      document.getElementById("presentation-tools") ??
      document.querySelector("header")
    )?.append(link);
  }
  update();
}
