// Counter-specific vector image recipe; the generic viewer does not know digits.
const segmentPaths = [
  "M64 40H192L176 56H80Z",
  "M200 48V120L184 112V64Z",
  "M200 136V208L184 192V144Z",
  "M192 216H64L80 200H176Z",
  "M56 208V136L72 144V192Z",
  "M56 120V48L72 64V112Z",
  "M68 120H188L176 136H80Z",
];
const active = [
  "abcdef",
  "bc",
  "abdeg",
  "abcdg",
  "bcfg",
  "acdfg",
  "acdefg",
  "abc",
  "abcdefg",
  "abcdfg",
];
export function digitSvg(digit: string) {
  const paths =
    digit === " "
      ? ""
      : segmentPaths
          .filter((_, i) => active[Number(digit)].includes("abcdefg"[i]))
          .map((d) => `<path d="${d}"/>`)
          .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><rect width="256" height="256" fill="#fffdf6"/><g fill="#1d4771">${paths}${digit === " " ? "" : '<rect x="112" y="232" width="32" height="4" rx="2"/>'}</g></svg>`;
}
