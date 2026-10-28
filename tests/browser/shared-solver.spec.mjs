import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

test("isolated legacy consumer commits the shared 42→43 direct path and independent replay retains every physical frame", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("#cube")).toHaveAttribute("aria-busy", "false");
  // The legacy library contract remains testable through an isolated consumer;
  // the normal Counter checkbox no longer selects this physical print.
  const commits = await page.evaluate(async () => {
    const { CubeViewer } = await import("/packages/cube-viewer/src/index.ts");
    const { CounterController } = await import(
      "/src/apps/counter/controller.ts"
    );
    const { loadCounterDesign } = await import("/src/apps/counter/design.ts");
    const host = document.createElement("div");
    host.style = "width:200px;height:200px";
    document.body.append(host);
    const viewer = new CubeViewer(host),
      commits = [];
    const animate = viewer.animate.bind(viewer);
    viewer.animate = async (p) => {
      await animate(p);
      commits.push({ move: p.move, cubies: p.to.cubies });
    };
    let finish, fail;
    const done = new Promise((resolve, reject) => {
      finish = resolve;
      fail = reject;
    });
    const controller = new CounterController(
      viewer,
      await loadCounterDesign(),
      (value, busy, error) => {
        if (error) fail(error);
        if (value === 43 && !busy) finish();
      },
    );
    await controller.configure("COUNTER", false, 42);
    controller.request(43);
    await done;
    if (controller.progress.sessionTotal !== 10)
      throw Error("Legacy committed accounting changed");
    viewer.destroy();
    host.remove();
    return commits;
  });
  expect(commits).toHaveLength(10);
  const word = commits
    .map(
      ({ move: m }) =>
        m.face + (m.turns === 2 ? "2" : m.turns === -1 ? "'" : ""),
    )
    .join(" ");
  expect(word).toBe("U R' U' F2 R2 U R F' U F'");
  const raw = readFileSync("public/counter-design.v2.json");
  const pin = JSON.parse(readFileSync("puzlwerk-source.json"));
  const result = JSON.parse(
    execFileSync("python3", ["tests/shared_solver_replay.py"], {
      encoding: "utf8",
      input: JSON.stringify({
        designSHA256: createHash("sha256").update(raw).digest("hex"),
        providerCommit: pin.commit,
        cases: [
          {
            padded: false,
            from: 42,
            to: 43,
            word,
            cubies: commits.at(-1).cubies,
          },
        ],
      }),
    }),
  );
  expect(result.status).toBe("PASS");
});

test("a missing shared table fails setup without enabling moves or a witness fallback", async ({
  page,
}) => {
  await page.route("**/*", (route) =>
    new URL(route.request().url()).pathname.endsWith(".bin")
      ? route.fulfill({ status: 404, body: "missing table" })
      : route.continue(),
  );
  await page.goto("/");
  await expect(page.locator("#error")).toContainText(
    "Shared solver table could not be loaded",
  );
  await expect(page.locator("#cube")).not.toHaveAttribute("data-value", /.+/);
  await expect(page.locator("#run")).toBeDisabled();
  await expect(page.locator("#set")).toBeDisabled();
});
