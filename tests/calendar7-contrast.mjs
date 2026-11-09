// WCAG 2.x contrast helpers shared by the calendar7 color tests (hex colors in the form #rrggbb).
export const lum = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};

export const contrast = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

/** Mix `hex` toward `target` (#rrggbb) by the share `k` (0..1), rounded per channel. */
export const mix = (hex, target, k) => {
  const ch = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const t = ch(target);
  return "#" + ch(hex).map((v, i) => Math.round(v + (t[i] - v) * k).toString(16).padStart(2, "0")).join("");
};
