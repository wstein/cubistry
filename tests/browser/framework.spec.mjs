import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
const design = JSON.parse(
  readFileSync(new URL("../../public/counter-design.v2.json", import.meta.url)),
);
async function ready(page) {
  await page.goto("/");
  await expect(page.locator("#cube")).toHaveAttribute("data-value", "0");
  await expect(page.locator("#cube")).toHaveAttribute("aria-busy", "false");
}
for (const [field, value] of [
  ["schema", "bad"],
  ["version", 999],
  ["puzzle", "5x5x5"],
])
  test(`browser rejects unsupported design ${field}`, async ({ page }) => {
    const bad = structuredClone(design);
    bad[field] = value;
    await page.route("**/counter-design.v2.json", (r) =>
      r.fulfill({ json: bad }),
    );
    await page.goto("/");
    await expect(page.locator("#error")).toContainText(
      "Unsupported counter design",
    );
    await expect(page.locator("#cube")).not.toHaveAttribute("data-value", /.+/);
    await expect(page.locator("#run")).toBeDisabled();
  });
test("generic viewer consumes a core state and legal transition without counter code", async ({
  page,
}) => {
  await ready(page);
  const result = await page.evaluate(async () => {
    const core = await import("/packages/cube-core/src/index.ts"),
      m = await import("/packages/cube-mechanics/src/index.ts"),
      a = await import("/packages/cube-assets/src/index.ts"),
      v = await import("/packages/cube-viewer/src/index.ts");
    const wire = await (await fetch("/counter-design.v2.json")).json();
    const print = core.validatePrint({
      ...wire.prints.padded,
      id: "generic-colored-example",
      stickers: wire.prints.padded.stickers.map((s) => ({
        ...s,
        assetId: "solid",
      })),
    });
    const manifest = {
      schema: "cubistry.assets",
      version: 1,
      fonts: [],
      documents: [],
      materials: [{ id: "sticker", color: "#ffffff", roughness: 0.7 }],
      images: [{ id: "solid", kind: "color", color: "#347455" }],
    };
    const loaded = await a.loadAssets(manifest, [print]);
    const host = document.createElement("div");
    host.style.cssText = "width:180px;height:180px";
    document.body.append(host);
    const viewer = new v.CubeViewer(host),
      source = m.initialState(print);
    viewer.configure(print, source, loaded);
    await viewer.animate(m.presentMove(source, m.parseMove("R")));
    const matches =
      JSON.stringify(viewer.presentedState) ===
      JSON.stringify(m.applyMove(source, m.parseMove("R")));
    const immutable =
      loaded.images.get("solid") instanceof ImageBitmap &&
      !("getContext" in loaded.images.get("solid")) &&
      !("set" in loaded.images);
    viewer.destroy();
    loaded.dispose();
    host.remove();
    return { matches, immutable };
  });
  expect(result).toEqual({ matches: true, immutable: true });
});
test("generic text assets honor declared weight and scaled line height and release owned fonts", async ({
  page,
}) => {
  await ready(page);
  const result = await page.evaluate(async () => {
    const { loadAssets } = await import("/packages/cube-assets/src/index.ts");
    const wire = await (await fetch("/counter-design.v2.json")).json();
    const manifest = {
      ...wire.assets,
      fonts: [{ ...wire.assets.fonts[0], weight: 500 }],
      documents: [
        {
          ...wire.assets.documents[0],
          text: "A\nB",
          fontSize: 40,
          minFontSize: 40,
          lineHeight: 80,
        },
      ],
      images: [
        {
          id: "text",
          kind: "text",
          documentId: "counter-title",
          crop: [0, 0, 512, 256],
        },
      ],
    };
    const calls = [],
      original = CanvasRenderingContext2D.prototype.fillText,
      before = document.fonts.size;
    CanvasRenderingContext2D.prototype.fillText = function (
      text,
      x,
      y,
      ...rest
    ) {
      calls.push({ text, y, font: this.font });
      return original.call(this, text, x, y, ...rest);
    };
    try {
      const loaded = await loadAssets(manifest, []);
      loaded.dispose();
      return { calls, before, after: document.fonts.size };
    } finally {
      CanvasRenderingContext2D.prototype.fillText = original;
    }
  });
  expect(result.calls.map((c) => c.y)).toEqual([88, 168]);
  expect(result.calls.every((c) => c.font.startsWith("500 40px"))).toBe(true);
  expect(result.after).toBe(result.before);
});
test("later unsafe SVG failure is transactional and existing counter remains usable", async ({
  page,
}) => {
  await ready(page);
  const evil =
      '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><script>alert(1)</script></svg>',
    sha = createHash("sha256").update(evil).digest("hex");
  await page.route("**/assets/test/evil.svg", (r) =>
    r.fulfill({ body: evil, contentType: "image/svg+xml" }),
  );
  const result = await page.evaluate(
    async ({ sha }) => {
      const { loadAssets } = await import("/packages/cube-assets/src/index.ts");
      const wire = await (await fetch("/counter-design.v2.json")).json();
      const manifest = {
        ...wire.assets,
        images: [
          { id: "temporary", kind: "color", color: "#ff0000" },
          {
            id: "evil",
            kind: "image",
            format: "svg",
            url: "/assets/test/evil.svg",
            sha256: sha,
          },
        ],
      };
      const original = ImageBitmap.prototype.close;
      let closed = 0;
      const before = document.fonts.size;
      ImageBitmap.prototype.close = function () {
        closed++;
        return original.call(this);
      };
      try {
        try {
          await loadAssets(manifest, []);
          return {
            error: "accepted",
            closed,
            before,
            after: document.fonts.size,
          };
        } catch (e) {
          return {
            error: e.message,
            closed,
            before,
            after: document.fonts.size,
          };
        }
      } finally {
        ImageBitmap.prototype.close = original;
      }
    },
    { sha },
  );
  expect(result.error).toContain("Unsafe SVG");
  expect(result.closed).toBe(1);
  expect(result.after).toBe(result.before);
  await page.locator('[data-delta="1"]').click();
  await expect(page.locator("#cube")).toHaveAttribute("data-value", "1");
});
test("PNG and WebP assets are actually decoded as immutable bounded images", async ({
  page,
}) => {
  await ready(page);
  const fixtures = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 8;
    canvas.getContext("2d").fillRect(0, 0, 8, 8);
    const out = [];
    for (const type of ["image/png", "image/webp"]) {
      const bytes = new Uint8Array(
        await (await new Promise((r) => canvas.toBlob(r, type))).arrayBuffer(),
      );
      const hash = [
        ...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
      ]
        .map((n) => n.toString(16).padStart(2, "0"))
        .join("");
      out.push({ type, format: type.split("/")[1], bytes: [...bytes], hash });
    }
    return out;
  });
  for (const f of fixtures)
    await page.route(`**/assets/test/picture.${f.format}`, (r) =>
      r.fulfill({ body: Buffer.from(f.bytes), contentType: f.type }),
    );
  const dimensions = await page.evaluate(async (fixtures) => {
    const { loadAssets } = await import("/packages/cube-assets/src/index.ts");
    const a = {
      schema: "cubistry.assets",
      version: 1,
      fonts: [],
      documents: [],
      materials: [],
      images: fixtures.map((f) => ({
        id: f.format,
        kind: "image",
        format: f.format,
        url: `/assets/test/picture.${f.format}`,
        sha256: f.hash,
      })),
    };
    const loaded = await loadAssets(a, []);
    const sizes = [...loaded.images.values()].map((i) => [i.width, i.height]);
    loaded.dispose();
    return sizes;
  }, fixtures);
  expect(dimensions).toEqual([
    [8, 8],
    [8, 8],
  ]);
});

test("SVG paint escapes cannot hide external references", async ({ page }) => {
  await ready(page);
  const result = await page.evaluate(async () => {
    const { validateSvg } = await import("/packages/cube-assets/src/index.ts");
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="u' + String.fromCharCode(92) + '72l(' + String.fromCharCode(92) + '68ttp' + String.fromCharCode(92) + '3a//example.test/paint.svg#x)"/></svg>';
    try { validateSvg(svg); return "accepted"; } catch (e) { return e.message; }
  });
  expect(result).toContain("Unsafe SVG attribute");
});

test("missing secure Web Crypto gives an actionable startup and asset diagnostic", async ({page}) => {
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>Object.defineProperty(globalThis.crypto,'subtle',{value:undefined,configurable:true}));
  await page.goto('/');await expect(page.locator('#error')).toContainText('Secure Web Crypto is unavailable');await expect(page.locator('#error')).toContainText('http://localhost:');await expect(page.locator('#error')).toContainText('HTTPS');await expect(page.locator('#cube')).not.toHaveAttribute('data-value','15');
  const diagnostic=await page.evaluate(async()=>{const {loadAssets}=await import('/packages/cube-assets/src/index.ts');const wire=await(await fetch('/counter-design.v2.json')).json();try{await loadAssets(wire.assets,[]);return 'accepted without integrity';}catch(error){return error.message;}});
  expect(diagnostic).toContain('Secure Web Crypto is unavailable');expect(diagnostic).toContain('localhost');expect(diagnostic).toContain('HTTPS');expect(errors).toEqual([]);
});

test("destroying a shared cube preserves the caller-owned canvas and other cube", async ({
  page,
}) => {
  await ready(page);
  const result = await page.evaluate(async () => {
    const { ClockStage } = await import("/src/apps/clock/stage.ts");
    const { loadCounterDesign } = await import("/src/apps/counter/design.ts");
    const { loadAssets } = await import("/packages/cube-assets/src/index.ts");
    const { initialState, presentMove, parseMove, applyMove } = await import(
      "/packages/cube-mechanics/src/index.ts"
    );
    const { stateEquals } = await import("/packages/cube-core/src/index.ts");
    const design = await loadCounterDesign();
    const host = document.createElement("div");
    host.style.cssText = "width:600px;height:250px";
    document.body.append(host);
    const stage = new ClockStage(host),
      first = stage.createCube(document.createElement("div"), 0),
      second = stage.createCube(document.createElement("div"), 1);
    const print = design.prints.padded,
      assets = await loadAssets(design.assets, [print]);
    const state = initialState(print);
    first.configure(print, state, assets);
    second.configure(print, state, assets);
    let disposed = 0,
      stopped = 0;
    const dispose = stage.renderer.dispose.bind(stage.renderer);
    stage.renderer.dispose = () => {
      disposed++;
      dispose();
    };
    const loop = stage.renderer.setAnimationLoop.bind(stage.renderer);
    stage.renderer.setAnimationLoop = (fn) => {
      if (fn === null) stopped++;
      return loop(fn);
    };
    first.destroy();
    await second.animate(presentMove(state, parseMove("R")));
    stage.renderer.render(stage.scene, stage.camera);
    const result = {
      canvasAlive: host.querySelectorAll("canvas").length === 1,
      disposed,
      stopped,
      otherCubeValid: stateEquals(
        second.presentedState,
        applyMove(state, parseMove("R")),
      ),
      roots: stage.presentation.children.filter((o) => o.type === "Group").length,
    };
    stage.destroy();
    assets.dispose();
    host.remove();
    return result;
  });
  expect(result).toEqual({
    canvasAlive: true,
    disposed: 0,
    stopped: 0,
    otherCubeValid: true,
    roots: 1,
  });
});
