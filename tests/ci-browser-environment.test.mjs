// SPDX-License-Identifier: AGPL-3.0-or-later
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateHost, validateBrowser, parseOsRelease } from "../scripts/ci/browser-environment.mjs";
const expected = JSON.parse(readFileSync(new URL("../scripts/ci/browser-environment.json", import.meta.url)));
const host = () => ({
  nodeVersion: "24.22.2", playwright: expected.playwright, architecture: "x64", platform: "linux",
  os: { ID: "ubuntu", VERSION_ID: "24.04" }, browserRoot: "/ms-playwright",
  docker: { driverVersion: expected.playwright, dockerImageName: expected.imageTag },
  chromiumRevision: expected.chromiumRevision, chromiumVersion: expected.chromiumVersion,
  executable: `/ms-playwright/chromium-${expected.chromiumRevision}/chrome-linux64/chrome`,
  executableExists: true, fonts: { ...expected.fonts },
});
const browser = () => ({
  version: expected.chromiumVersion, renderer: "ANGLE (Google, Vulkan (SwiftShader Device))",
  timezone: "UTC", webglVersion: "WebGL 2.0", pixels: [21, 59, 97, 255],
  fontLoaded: true, textWidth: 420, launchArgs: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
test("the pinned host matches Node, Playwright, Noble, browser revision and font bytes", () => {
  assert.deepEqual(validateHost(host(), expected), []);
  for (const [key, value] of Object.entries({ nodeVersion: "26.0.0", playwright: "1.63.0", architecture: "arm64", browserRoot: "/tmp/browsers", chromiumRevision: "1", executableExists: false })) {
    assert.ok(validateHost({ ...host(), [key]: value }, expected).length > 0, key);
  }
  assert.ok(validateHost({ ...host(), os: { ID: "ubuntu", VERSION_ID: "22.04" } }, expected).length > 0);
  assert.ok(validateHost({ ...host(), docker: { driverVersion: "1.63.0", dockerImageName: expected.imageTag } }, expected).length > 0);
  assert.ok(validateHost({ ...host(), fonts: {} }, expected).length > 0);
});
test("the browser probe requires actual SwiftShader, WebGL2, loaded font and exact pixel output", () => {
  assert.deepEqual(validateBrowser(browser(), expected), []);
  for (const [key, value] of Object.entries({ version: "155.0.0.0", renderer: "hardware GPU", timezone: "America/Los_Angeles", webglVersion: "WebGL 1.0", fontLoaded: false, textWidth: 0, pixels: [0, 0, 0, 0], launchArgs: [] })) {
    assert.ok(validateBrowser({ ...browser(), [key]: value }, expected).length > 0, key);
  }
});
test("OS release fields are read without executing shell content", () => {
  assert.deepEqual(parseOsRelease('ID=ubuntu\nVERSION_ID="24.04"\nNAME="Ubuntu"\n'), { ID: "ubuntu", VERSION_ID: "24.04", NAME: "Ubuntu" });
});
