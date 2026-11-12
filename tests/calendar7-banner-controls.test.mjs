// SPDX-License-Identifier: AGPL-3.0-or-later
// Calendar7 month banner choice: the select, the `banner` URL parameter, the stage call and the viewer-local override
// (fake DOM, fake stage; no WebGL, no browser, no network).
import { test } from "node:test";
import assert from "node:assert/strict";
import { mountCalendar7 } from "../src/apps/calendar7/mount.ts";
import { Calendar7Viewer } from "../src/apps/calendar7/viewer.ts";
import { DEFAULT_SCHEME, schemeById, resolvedBannerStyle } from "../src/apps/calendar7/schemes.ts";
import { fakeRoot, setup, settle } from "./helpers/calendar7-mount.mjs";

const flush = async () => {
  for (let i = 0; i < 100; i++) await Promise.resolve();
};

function fixture(options = {}) {
  const a = setup(options);
  a.stage.banners = [];
  a.stage.schemes = [];
  a.stage.setBannerStyle = (s) => a.stage.banners.push(s);
  a.stage.setScheme = (s) => a.stage.schemes.push(s);
  const configure = a.stage.configure?.bind(a.stage);
  a.stage.calls = [];
  a.stage.configure = (...args) => {
    a.stage.calls.push("configure");
    return configure?.(...args);
  };
  const setBanner = a.stage.setBannerStyle;
  a.stage.setBannerStyle = (s) => {
    a.stage.calls.push("banner");
    setBanner(s);
  };
  return a;
}

test("Banner style offers six choices, Theme default first and selected, and tells the stage before the first configure", async () => {
  const root = fakeRoot(),
    { env, stage } = fixture();
  const i = await mountCalendar7(root, new URLSearchParams("year=2026&month=11"), env);
  await settle(root, "2026-11");
  assert.match(root.html, /<label for="c7-banner-style">Banner style<\/label>/);
  const html = root.html.match(/<select[^>]*data-c7="banner"[^>]*>([\s\S]*?)<\/select>/)[1];
  assert.deepEqual(
    [...html.matchAll(/<option value="([^"]+)"/g)].map((m) => m[1]),
    ["theme", "rounded", "square", "underline", "boxed", "rounded-box"],
  );
  assert.match(html, /<option value="theme" selected>Theme default/);
  assert.deepEqual(stage.banners, ["theme"]);
  assert.ok(stage.calls.indexOf("banner") < stage.calls.indexOf("configure"));
  assert.equal(root.getAttribute("data-c7-banner"), "theme");
  i.dispose();
});

test("an explicit banner persists across color-theme changes and instant date changes", async () => {
  const root = fakeRoot(),
    { env, stage } = fixture({
      search: "?app=calendar7&year=2026&month=11&scheme=paper-blue&font=nunito&extra=keep",
    });
  const i = await mountCalendar7(root, new URLSearchParams(env.search()), env);
  await settle(root, "2026-11");
  root.choose("banner", "underline");
  root.choose("scheme", "dracula");
  root.date(2026, 2);
  await settle(root, "2026-02");
  assert.equal(stage.banners.at(-1), "underline");
  assert.equal(root.el("banner").value, "underline");
  assert.equal(stage.schemes.at(-1), "dracula");
  let p = new URLSearchParams(env.search());
  for (const [k, v] of [
    ["banner", "underline"],
    ["scheme", "dracula"],
    ["font", "nunito"],
    ["extra", "keep"],
    ["month", "2"],
  ])
    assert.equal(p.get(k), v);
  root.choose("banner", "theme");
  p = new URLSearchParams(env.search());
  assert.equal(p.has("banner"), false);
  assert.equal(p.get("scheme"), "dracula");
  assert.equal(stage.banners.at(-1), "theme");
  i.dispose();
});

for (const style of ["rounded", "square", "underline", "boxed", "rounded-box"])
  test(`?banner=${style} reaches the stage and is selected`, async () => {
    const root = fakeRoot(),
      { env, stage } = fixture({ search: `?app=calendar7&year=2026&month=11&banner=${style}` });
    const i = await mountCalendar7(root, new URLSearchParams(env.search()), env);
    await settle(root, "2026-11");
    assert.deepEqual(stage.banners, [style]);
    assert.equal(root.getAttribute("data-c7-banner"), style);
    assert.match(root.html, new RegExp(`<option value="${style}" selected>`));
    i.dispose();
  });

test("unknown banner values use Theme default and normalize only obsolete query parameters", async () => {
  const root = fakeRoot(),
    { env, stage } = fixture({
      search: "?app=calendar7&layout=standard&banner=unknown&scheme=paper-blue&font=quicksand&year=2026&month=11",
    });
  const i = await mountCalendar7(root, new URLSearchParams(env.search()), env);
  await settle(root, "2026-11");
  const p = new URLSearchParams(env.search());
  assert.equal(p.has("banner"), false);
  assert.equal(p.has("layout"), false);
  assert.equal(p.get("scheme"), "paper-blue");
  assert.equal(p.get("font"), "quicksand");
  assert.deepEqual(stage.banners, ["theme"]);
  i.dispose();
});

test("a banner selected during a pending viewer load reaches its first configure", async () => {
  const root = fakeRoot(),
    { env, stage } = fixture();
  let release;
  env.createStage = () => new Promise((r) => (release = r));
  const i = await mountCalendar7(root, new URLSearchParams("year=2026&month=11"), env);
  root.choose("banner", "square");
  root.choose("scheme", "paper-blue");
  release(stage);
  await settle(root, "2026-11");
  assert.deepEqual(stage.banners, ["square"]);
  assert.equal(stage.schemes.at(-1), "paper-blue");
  i.dispose();
});

test("queued date edits are latest-wins and navigation or dispose cancels pending edits", async () => {
  const root = fakeRoot(),
    { env, calls } = fixture();
  const i = await mountCalendar7(root, new URLSearchParams("year=2026&month=11"), env);
  await settle(root, "2026-11");
  root.date(2026, 2);
  root.date(2099, 12);
  await settle(root, "2099-12");
  assert.equal(calls.query.length, 1);
  assert.match(calls.query[0], /year=2099&month=12/);
  const count = calls.query.length;
  root.date(2099, 12);
  await flush();
  assert.equal(calls.query.length, count, "same value does not rerender inside blur");
  root.date(2026, 2);
  root.clickLink("?app=calendar7&year=2026&month=11");
  await settle(root, "2026-11");
  await flush();
  assert.equal(root.getAttribute("data-c7-month"), "2026-11");
  root.date(2026, 2);
  i.dispose();
  await flush();
  assert.equal(root.getAttribute("data-c7-month"), "2026-11");
});

test("viewer banner overrides are instance-local and Theme default follows the current raw palette", () => {
  const make = () =>
    Object.assign(Object.create(Calendar7Viewer.prototype), {
      baseScheme: DEFAULT_SCHEME,
      scheme: DEFAULT_SCHEME,
      bannerStyle: "theme",
      layout: "names",
      destroyed: false,
    });
  const a = make(),
    b = make();
  a.setScheme("paper-blue");
  assert.equal(a.currentScheme, schemeById("paper-blue"));
  assert.equal(resolvedBannerStyle(a.scheme), "underline");
  a.setBannerStyle("underline");
  a.setScheme("paper-red");
  assert.equal(resolvedBannerStyle(a.scheme), "underline");
  assert.equal(a.currentScheme, DEFAULT_SCHEME);
  assert.equal(b.currentScheme, DEFAULT_SCHEME);
  assert.equal(b.bannerStyle, "theme");
  a.setBannerStyle("theme");
  assert.equal(resolvedBannerStyle(a.scheme), "rounded");
  assert.equal(Object.hasOwn(DEFAULT_SCHEME, "bannerStyle"), false);
  a.destroyed = true;
  a.setBannerStyle("square");
  assert.equal(a.bannerStyle, "theme");
});

test("normalizing filtered adapter parameters preserves the host app and unrelated URL state", async () => {
  const root = fakeRoot(),
    { env } = fixture({
      search:
        "?app=calendar7&layout=names-demo&banner=bogus&year=2026&month=11&scheme=paper-blue&font=nunito&host=keep",
    });
  const filtered = new URLSearchParams(
    "layout=names-demo&banner=bogus&year=2026&month=11&scheme=paper-blue&font=nunito",
  );
  const i = await mountCalendar7(root, filtered, env);
  await settle(root, "2026-11");
  const p = new URLSearchParams(env.search());
  for (const [k, v] of [
    ["app", "calendar7"],
    ["host", "keep"],
    ["scheme", "paper-blue"],
    ["font", "nunito"],
    ["year", "2026"],
    ["month", "11"],
  ])
    assert.equal(p.get(k), v);
  assert.equal(p.has("layout"), false);
  assert.equal(p.has("banner"), false);
  i.dispose();
});
