/**
 * Body of the Live Clock panel: the digital clock and the status line, as in the studio clock mode before the port.
 * Everything else sits in the dock slots (controls.ts) and in the Nerd drawer (nerd.ts). The ids are the ones
 * clock.html used.
 */
export function clockHudHtml(): string {
  return `
    <div class="clock-digital">
      <output id="clock-digital" aria-label="Current local time" aria-live="off">--:--:--</output>
    </div>
    <p id="clock-status" class="small" role="status">Preparing the verified fixed prints…</p>
  `;
}
