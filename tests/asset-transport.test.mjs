import test from "node:test";
import assert from "node:assert/strict";
import {
  assetTransportPath,
  deploymentBasePath,
} from "../packages/cube-assets/src/index.ts";
test("deployment prefix only changes validated transport, never canonical asset identity", () => {
  assert.equal(
    assetTransportPath("/images/digits/0.svg"),
    "/images/digits/0.svg",
  );
  assert.equal(
    assetTransportPath("/images/digits/0.svg", "/cubistry/"),
    "/cubistry/images/digits/0.svg",
  );
  for (const base of [
    "https://example.test/",
    "//host/",
    "/../",
    "/a//",
    "/a",
    "/a?b/",
    "/%2e/",
    null,
  ])
    assert.throws(() => deploymentBasePath(base));
  for (const path of [
    "https://example.test/0.svg",
    "/a/../0.svg",
    "/0.svg?q=1",
  ])
    assert.throws(() => assetTransportPath(path, "/cubistry/"));
});
