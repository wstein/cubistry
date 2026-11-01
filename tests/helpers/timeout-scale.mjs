// The `timing` group of the CI matrix runs the animation- and precision-sensitive specs on software-rendered
// Chromium, where they take about two to three times as long as locally. Explicit per-test limits scale with it.
export const timeoutScale = process.env.CUBISTRY_E2E_GROUP === "timing" ? 3 : 1;
export const scaled = (milliseconds) => milliseconds * timeoutScale;
