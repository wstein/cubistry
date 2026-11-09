// SPDX-License-Identifier: AGPL-3.0-or-later
import { test, expect } from "@playwright/test";

test("Chromium self insertion removes and reinserts a row and blurs its Dismiss button", async ({ page }) => {
  await page.setContent('<div id="rows"><div id="row"><button>Dismiss</button></div><p>Next</p></div>');
  const result = await page.evaluate(() => {
    const parent = document.querySelector("#rows");
    const row = document.querySelector("#row");
    const button = row.querySelector("button");
    button.focus();
    const observer = new MutationObserver(() => {});
    observer.observe(parent, { childList: true });
    parent.insertBefore(row, row);
    const records = observer.takeRecords();
    observer.disconnect();
    return {
      mutations: records.length,
      removed: records.some((record) => [...record.removedNodes].includes(row)),
      added: records.some((record) => [...record.addedNodes].includes(row)),
      bodyFocused: document.activeElement === document.body,
      order: [...parent.children].map((node) => node.textContent),
    };
  });
  expect(result).toEqual({ mutations: 2, removed: true, added: true, bodyFocused: true, order: ["Dismiss", "Next"] });
});

test("adding a warning preserves the existing error row and its focused Dismiss button", async ({ page }) => {
  await page.goto("/index.html?app=clock");
  const result = await page.evaluate(async () => {
    const { createShellHost } = await import("/src/apps/shell/slot-api.ts");
    const fixture = document.createElement("div");
    document.body.append(fixture);
    const make = (tag = "div") => fixture.appendChild(document.createElement(tag));
    const regions = {
      status: make(), alerts: make(), primary: make(),
      slots: Object.fromEntries([1, 2, 3, 4, 5].map((number) => [number, make()])),
      readout: make(), nerd: make(), nerdToggle: make("button"), hints: make(), reference: make("button"),
    };
    const host = createShellHost(regions, document);
    try {
      const shell = host.begin(() => true);
      shell.setError({ text: "Keep this error" });
      const row = regions.alerts.querySelector('[data-kind="error"]');
      const button = row.querySelector("button");
      button.focus();
      const observer = new MutationObserver(() => {});
      observer.observe(regions.alerts, { childList: true });
      shell.setWarning({ title: "Warning", text: "Added beside the error" });
      shell.setStatus("ready", "Ready");
      const records = observer.takeRecords();
      observer.disconnect();
      return {
        focusPreserved: document.activeElement === button,
        sameRow: regions.alerts.querySelector('[data-kind="error"]') === row,
        removedError: records.some((record) => [...record.removedNodes].includes(row)),
        order: [...regions.alerts.children].map((node) => node.dataset.kind),
      };
    } finally {
      host.destroy();
      fixture.remove();
    }
  });
  expect(result).toEqual({ focusPreserved: true, sameRow: true, removedError: false, order: ["warn", "error"] });
});
