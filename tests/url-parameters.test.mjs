import test from "node:test";
import assert from "node:assert/strict";

test("URL parameter parsing maps setup parameters correctly", () => {
  const parseParams = (search) => {
    const params = new URLSearchParams(search);
    const unit = params.get("unit") || params.get("letter");
    const dir = params.get("dir") || params.get("direction");
    const val = params.get("val") || params.get("value");
    const speed = params.get("speed");
    const lettering = params.get("lettering");
    const font = params.get("font") || params.get("display");
    const marker = params.get("marker");
    const presentation = params.get("presentation") ?? params.get("kiosk");
    const run = params.get("run") ?? params.get("autoplay");

    return {
      unit: unit ? unit.toUpperCase() : null,
      dir: dir ? (["down", "-1"].includes(dir.toLowerCase()) ? "-1" : "1") : null,
      val: val ? val.padStart(2, "0") : null,
      speed: speed ? Number(speed) : null,
      lettering,
      font: font ? font.toLowerCase() : null,
      marker: marker ? marker.toLowerCase() : null,
      isPresentation: presentation === "1" || presentation === "true",
      isAutoRun: run === "1" || run === "true",
    };
  };

  const parsed = parseParams("?unit=S&val=45&dir=down&speed=250&presentation=1&run=1");
  assert.equal(parsed.unit, "S");
  assert.equal(parsed.val, "45");
  assert.equal(parsed.dir, "-1");
  assert.equal(parsed.speed, 250);
  assert.equal(parsed.isPresentation, true);
  assert.equal(parsed.isAutoRun, true);

  const kioskAutoplay = parseParams("?kiosk=1&autoplay=1&lettering=words-pascal&font=outfit&marker=line-auto");
  assert.equal(kioskAutoplay.isPresentation, true);
  assert.equal(kioskAutoplay.isAutoRun, true);
  assert.equal(kioskAutoplay.lettering, "words-pascal");
  assert.equal(kioskAutoplay.font, "outfit");
  assert.equal(kioskAutoplay.marker, "line-auto");
});

test("Run guard prevents mutating URL search params during active motion", () => {
  let url = "http://localhost:5173/ms-counter.html?unit=S&val=30";
  let isRunning = true;

  const syncSetupUrl = (changes) => {
    if (isRunning) return; // Must NEVER change during run!
    const parsed = new URL(url);
    for (const [k, v] of Object.entries(changes)) {
      parsed.searchParams.set(k, v);
    }
    url = parsed.toString();
  };

  // Simulating ticks during active run
  syncSetupUrl({ val: "31" });
  syncSetupUrl({ val: "32" });
  assert.equal(url, "http://localhost:5173/ms-counter.html?unit=S&val=30"); // Unchanged!

  // Now user stops run and manually changes unit
  isRunning = false;
  syncSetupUrl({ unit: "M", val: "00" });
  assert.equal(url, "http://localhost:5173/ms-counter.html?unit=M&val=00");
});
