import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(".");

test("dedicated MPA pages exist and contain valid markup", () => {
  const pages = [
    { file: "timer.html", app: "timer", title: "60-Minute Timer" },
    { file: "five-second-timer.html", app: "five-second-timer", title: "5-Second Timer" },
    { file: "tenth-counter.html", app: "tenth-counter", title: "1/10-Second Counter" },
    { file: "hsm-counter.html", app: "hsm-counter", title: "H/M/S Counter" },
    { file: "ms-counter.html", app: "ms-counter", title: "M/S Counter" },
    { file: "hm-one-cube.html", app: "hm-one-cube", title: "H/M One-Cube Counter" },
    { file: "counter.html", app: "certified", title: "Counter" },
  ];

  for (const { file, app, title } of pages) {
    const filePath = path.join(root, file);
    assert.ok(fs.existsSync(filePath), `${file} should exist`);
    const content = fs.readFileSync(filePath, "utf-8");
    assert.match(content, new RegExp(`<title>Cubistry · ${title}</title>`), `${file} has correct title`);
    assert.match(content, new RegExp(`data-default-application="${app}"`), `${file} has default application`);
    assert.match(content, /<script type="module" src="\/src\/main\.mjs"><\/script>/, `${file} loads main.mjs`);
    assert.match(content, /<footer class="floating-glass-pill"/, `${file} includes floating glass pill`);
    assert.match(content, /href="https:\/\/github\.com\/wstein\/cubistry\/"/, `${file} links to cubistry repo`);
  }
});

test("all navigation selects use clean HTML URLs for single-cube applications", () => {
  const htmlFiles = [
    "counter.html",
    "ms-timer.html",
    "playground.html",
    "picture3.html",
    "status.html",
    "licenses.html",
  ];

  for (const file of htmlFiles) {
    const content = fs.readFileSync(path.join(root, file), "utf-8");
    assert.match(content, /<option value="counter\.html"(?: selected)?>Counter 0–99<\/option>/, `${file} links to counter.html`);
    assert.match(content, /<option value="timer\.html">60-Minute Timer<\/option>/, `${file} links to timer.html`);
    assert.match(content, /<option value="five-second-timer\.html">5-Second Timer<\/option>/, `${file} links to five-second-timer.html`);
    assert.match(content, /<option value="tenth-counter\.html">1\/10-Second Counter 0–9<\/option>/, `${file} links to tenth-counter.html`);
    assert.match(content, /<option value="hsm-counter\.html">H\/M\/S Counter 00–59<\/option>/, `${file} links to hsm-counter.html`);
    assert.match(content, /<option value="ms-counter\.html">M\/S Counter 00–59<\/option>/, `${file} links to ms-counter.html`);
    assert.match(content, /<option value="hm-one-cube\.html">H\/M One-Cube Counter<\/option>/, `${file} links to hm-one-cube.html`);
    assert.match(content, /href="https:\/\/github\.com\/wstein\/cubistry\/"/, `${file} links to cubistry repo`);
  }
});
