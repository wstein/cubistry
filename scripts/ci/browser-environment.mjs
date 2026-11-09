// SPDX-License-Identifier: AGPL-3.0-or-later
/** Qualify the pinned CI browser without installing browsers or OS packages. */
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import { execFileSync } from "node:child_process";
import { chromium } from "@playwright/test";
import base from "../../playwright.config.mjs";
const require = createRequire(import.meta.url);
export const environment = JSON.parse(readFileSync(new URL("./browser-environment.json", import.meta.url)));
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function parseOsRelease(text) {
  return Object.fromEntries(text.split("\n").filter(line => /^[A-Z_]+=/.test(line)).map(line => {
    const i = line.indexOf("="), value = line.slice(i + 1);
    return [line.slice(0, i), value.replace(/^"|"$/g, "")];
  }));
}
export function validateHost(actual, expected) {
  const errors = [];
  const check = (condition, label) => { if (!condition) errors.push(label); };
  check(Number(actual.nodeVersion?.split(".")[0]) === expected.nodeMajor, "Node major differs");
  check(actual.playwright === expected.playwright, "Playwright package differs");
  check(actual.architecture === expected.architecture && actual.platform === "linux", "runner architecture differs");
  check(actual.os?.ID === expected.os.ID && actual.os?.VERSION_ID === expected.os.VERSION_ID, "OS differs");
  check(actual.browserRoot === expected.browserRoot, "preinstalled browser root differs");
  check(actual.docker?.driverVersion === expected.playwright && actual.docker?.dockerImageName === expected.imageTag, "Playwright image marker differs");
  check(actual.chromiumRevision === expected.chromiumRevision && actual.chromiumVersion === expected.chromiumVersion, "bundled browser revision differs");
  check(actual.executableExists && actual.executable?.startsWith(`${expected.browserRoot}/chromium-${expected.chromiumRevision}/`), "preinstalled Chromium is missing");
  check(actual.selectedBrowser === "chromium-headless-shell", "default headless browser differs");
  check(actual.selectedRevision === expected.chromiumRevision && actual.selectedDescriptorVersion === expected.chromiumVersion, "headless descriptor differs");
  check(actual.selectedExecutableExists && actual.selectedExecutable === `${expected.browserRoot}/chromium_headless_shell-${expected.chromiumRevision}/chrome-headless-shell-linux64/chrome-headless-shell`, "selected headless executable differs");
  check(actual.selectedBinaryVersion === expected.runtimeVersion, "selected binary version differs");
  for (const [font, hash] of Object.entries(expected.fonts))
    check(actual.fonts?.[font] === hash, `font bytes differ: ${font}`);
  return errors;
}
export function validateBrowser(actual, expected) {
  const errors = [];
  const check = (condition, label) => { if (!condition) errors.push(label); };
  check(actual.version === expected.runtimeVersion, "launched Chromium version differs");
  check(/SwiftShader/i.test(actual.renderer || ""), "software renderer differs");
  check(actual.webglVersion?.startsWith("WebGL 2.0"), "WebGL2 is unavailable");
  check(equal(actual.pixels, [21, 59, 97, 255]), "rendered pixel differs");
  check(actual.fontLoaded === true && actual.textWidth > 0, "bundled font did not load");
  check(actual.timezone === expected.timezone, "browser time zone differs");
  check(equal(actual.launchArgs, expected.launchArgs), "browser launch flags differ");
  return errors;
}
export function inspectHost() {
  const core = require.resolve("playwright-core/package.json");
  const browsers = JSON.parse(readFileSync(new URL("browsers.json", `file://${core}`)));
  const browser = browsers.browsers.find(item => item.name === "chromium");
  const executable = chromium.executablePath();
  // Playwright's no-channel, headless launch selects this exact registry entry.
  // This internal API is covered by the exact package pin; no fallback is allowed.
  const selected = require("playwright-core/lib/coreBundle").registry.registry.findExecutable("chromium-headless-shell");
  const selectedExecutable = selected.executablePath();
  const selectedBinaryVersion = execFileSync(selectedExecutable, ["--version"], { encoding: "utf8" }).trim().replace(/^Google Chrome for Testing |^Chromium |^Google Chrome |^Chrome Headless Shell /, "");
  return {
    nodeVersion: process.versions.node, playwright: require("@playwright/test/package.json").version,
    architecture: process.arch, platform: process.platform,
    os: parseOsRelease(readFileSync("/etc/os-release", "utf8")),
    browserRoot: process.env.PLAYWRIGHT_BROWSERS_PATH,
    docker: JSON.parse(readFileSync("/ms-playwright/.docker-info", "utf8")),
    chromiumRevision: browser.revision, chromiumVersion: browser.browserVersion,
    selectedBrowser: selected.name, selectedRevision: selected.revision,
    selectedDescriptorVersion: selected.browserVersion, selectedExecutable,
    selectedExecutableExists: existsSync(selectedExecutable), selectedBinaryVersion,
    executable, executableExists: existsSync(executable),
    fonts: Object.fromEntries(Object.keys(environment.fonts).map(path => [path, createHash("sha256").update(readFileSync(path)).digest("hex")])),
    systemSans: execFileSync("fc-match", ["--format", "%{family}|%{style}|%{file}\n", "sans-serif"], { encoding: "utf8" }).trim(),
  };
}
/** The same flags as every existing Playwright suite; this changes no test settings. */
export async function probeBrowser() {
  const launchArgs = base.use.launchOptions.args;
  const started = performance.now();
  const browser = await chromium.launch({ args: launchArgs });
  const launchMs = performance.now() - started;
  try {
    const page = await browser.newPage();
    const bytes = readFileSync("public/fonts/noto-sans-latin-600.woff2").toString("base64");
    const result = await page.evaluate(async fontUrl => {
      const face = new FontFace("Cubistry CI Probe", `url(${fontUrl})`, { weight: "600" });
      await face.load(); document.fonts.add(face);
      const text = document.createElement("canvas").getContext("2d");
      text.font = '600 32px "Cubistry CI Probe"';
      const canvas = document.createElement("canvas"); canvas.width = 1; canvas.height = 1;
      const gl = canvas.getContext("webgl2");
      if (!gl) throw new Error("WebGL2 context could not be created");
      const debug = gl.getExtension("WEBGL_debug_renderer_info");
      gl.clearColor(21 / 255, 59 / 255, 97 / 255, 1); gl.clear(gl.COLOR_BUFFER_BIT);
      const pixel = new Uint8Array(4);
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      return {
        fontLoaded: face.status === "loaded" && document.fonts.check('600 32px "Cubistry CI Probe"'),
        textWidth: text.measureText("MON FRI 23/30 24/31").width,
        renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
        webglVersion: gl.getParameter(gl.VERSION), pixels: Array.from(pixel),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      };
    }, `data:font/woff2;base64,${bytes}`);
    return { version: browser.version(), ...result, launchArgs, launchMs, probeMs: performance.now() - started };
  } finally { await browser.close(); }
}
async function main() {
  const outputIndex = process.argv.indexOf("--output");
  if (outputIndex < 0 || !process.argv[outputIndex + 1]) throw new Error("--output path is required");
  const receipt = { image: environment.image, commit: process.env.GITHUB_SHA, job: process.env.GITHUB_JOB, startedAt: new Date().toISOString() };
  const started = performance.now();
  try {
    receipt.host = inspectHost();
    receipt.errors = validateHost(receipt.host, environment);
    if (receipt.errors.length) throw new Error(receipt.errors.join("; "));
    receipt.browser = await probeBrowser();
    receipt.errors = validateBrowser(receipt.browser, environment);
    if (receipt.errors.length) throw new Error(receipt.errors.join("; "));
    receipt.ok = true;
  } catch (error) {
    receipt.ok = false; receipt.error = error.message; process.exitCode = 1;
  } finally {
    receipt.totalMs = performance.now() - started;
    writeFileSync(process.argv[outputIndex + 1], `${JSON.stringify(receipt, null, 2)}\n`);
    console.log(JSON.stringify(receipt));
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
