import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

test("counter commits the shared 42→43 direct path and independent replay retains every physical frame", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("#cube")).toHaveAttribute("aria-busy", "false");
  await page.locator("#format").uncheck();
  await expect(page.locator("#application")).toBeEnabled();
  await page.locator("#value").fill("15");
  await page.locator("#set").click();
  await expect(page.locator("#cube")).toHaveAttribute("data-value", "15");
  await expect(page.locator("#cube")).toHaveAttribute("aria-busy", "false");
  await page.locator(".move-details").evaluate(el => el.open = true);
  await page.locator("#reset-session-moves").click();
  await page.locator("#value").fill("42");
  await page.locator("#set").click();
  await expect(page.locator("#cube")).toHaveAttribute("data-value", "42");
  await expect(page.locator("#cube")).toHaveAttribute("aria-busy", "false");
  await page.evaluate(async () => {
    const { CubeViewer } = await import("/packages/cube-viewer/src/index.ts");
    const original = CubeViewer.prototype.animate;
    window.sharedCommits = [];
    CubeViewer.prototype.animate = async function (p) {
      await original.call(this, p);
      window.sharedCommits.push({ move: p.move, cubies: p.to.cubies });
    };
  });
  await page.locator("#value").fill("43");
  await page.locator("#set").click();
  await expect(page.locator("#cube")).toHaveAttribute("data-value", "43");
  await expect(page.locator("#cube")).toHaveAttribute("aria-busy", "false");
  await expect(page.locator("#move-progress")).toHaveText("10 / 10 moves");
  const commits = await page.evaluate(() => window.sharedCommits);
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
