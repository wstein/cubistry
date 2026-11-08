import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { findShellRegions, STATUS_STATES } from "../src/apps/shell/slot-api.ts";

// Source checks for the dock markup (index.html) and the dock rules (src/shell/shell.css) that the slot API relies on.

const html = readFileSync("index.html", "utf8");
const css = readFileSync("src/shell/shell.css", "utf8");
const tokens = readFileSync("src/shell/tokens.css", "utf8");
const at = (needle) => {
  const i = html.indexOf(needle);
  assert.ok(i >= 0, `index.html contains ${needle}`);
  return i;
};
const tag = (needle) => html.slice(html.lastIndexOf("<", at(needle)), html.indexOf(">", at(needle)) + 1);

test("the dock lists status, primary action, the five slots in order and the legacy controls", () => {
  const order = ['data-region="status-zone"', 'data-region="primary-action"', 'data-slot="1"', 'data-slot="2"', 'data-slot="3"',
    'data-slot="4"', 'data-slot="5"', 'id="studio-controls"'].map(at);
  assert.deepEqual([...order].sort((a, b) => a - b), order, "document order is tab order");
});

test("the Nerd button sits in the header after the Appearance button and before Presentation, built like them", () => {
  const header = html.slice(at('<header class="shell-header"'), at("</header>"));
  const order = ['id="appearance-btn"', 'id="nerd-toggle"', 'id="presentation-btn"'].map((n) => {
    const i = header.indexOf(n);
    assert.ok(i >= 0, `${n} is inside the header`);
    return i;
  });
  assert.deepEqual([...order].sort((a, b) => a - b), order, "focus order: Appearance, Nerd, Presentation");
  const nerd = tag('id="nerd-toggle"');
  assert.match(nerd, /class="shell-btn[ "]/);
  assert.match(nerd, /\sdata-app-only[\s>]/, "hidden on the landing page like the other header buttons");
  assert.match(nerd, /aria-label="Nerd mode"/, "the label survives the phone width, where .btn-text is hidden");
  const at2 = html.indexOf('id="nerd-toggle"');
  const inner = html.slice(at2, html.indexOf("</button>", at2));
  assert.match(inner, /class="btn-icon" aria-hidden="true"/);
  assert.match(inner, /class="btn-text"> Nerd mode</);
  assert.ok(html.indexOf('data-region="dock"') > html.indexOf("</header>") && !html.slice(html.indexOf('data-region="dock"')).includes('id="nerd-toggle"'), "no second button in the dock");
});

test("slots, primary action, readout, nerd drawer, hints and reference view start hidden", () => {
  for (const needle of ['data-region="primary-action"', 'data-slot="1"', 'data-slot="2"', 'data-slot="3"', 'data-slot="4"',
    'data-slot="5"', 'data-region="readout"', 'data-region="nerd-drawer"', 'data-region="hints"', 'data-region="reference-view"', 'id="nerd-toggle"']) {
    assert.match(tag(needle), /\shidden[\s>]/, needle);
  }
});

test("only the status zone is a live region; the readout and the nerd drawer carry no live semantics", () => {
  assert.match(tag('data-region="status-zone"'), /role="status"/);
  for (const needle of ['data-region="readout"', 'data-region="nerd-drawer"', 'data-region="primary-action"']) {
    assert.doesNotMatch(tag(needle), /role=|aria-live/, needle);
  }
  assert.equal(html.match(/aria-live=/g).length, 1);
  assert.equal(html.match(/role="status"/g).length, 1);
});

test("no element of the page uses a positive tabindex", () => {
  assert.doesNotMatch(html, /tabindex="[1-9]/);
});

test("the Nerd button is a toggle that controls the drawer", () => {
  const button = tag('id="nerd-toggle"');
  assert.match(button, /^<button type="button"/);
  assert.match(button, /aria-pressed="false"/);
  assert.match(button, /aria-controls="shell-nerd"/);
  assert.match(tag('data-region="nerd-drawer"'), /id="shell-nerd"/);
  assert.doesNotMatch(button, /data-region/, "the region names stay unique");
});

test("findShellRegions resolves every region from the page's selectors and names the missing one", () => {
  const selectors = [];
  const root = { querySelector: (s) => (selectors.push(s), { selector: s }) };
  const regions = findShellRegions(root);
  for (const s of selectors) {
    const attr = s.match(/\[(data-[a-z]+)="([^"]+)"\]/);
    if (attr) assert.ok(html.includes(`${attr[1]}="${attr[2]}"`), `${s} exists in index.html`);
    else assert.ok(html.includes(s.slice(1).replace(/^/, 'id="') + '"'), `${s} exists in index.html`);
  }
  assert.equal(Object.keys(regions.slots).length, 5);
  assert.throws(() => findShellRegions({ querySelector: (s) => (s.includes("readout") ? null : {}) }), /readout/);
});

test("the stylesheet colors each chip state with its design token", () => {
  for (const state of STATUS_STATES) {
    const rule = css.match(new RegExp(`\\.shell-chip\\[data-state="${state}"\\]\\s*\\{([^}]*)\\}`));
    assert.ok(rule, `chip rule for ${state}`);
    assert.match(rule[1], new RegExp(`var\\(--s-${state}\\)`), state);
    assert.match(tokens, new RegExp(`--s-${state}:`), `${state} token defined`);
  }
});

test("slot, nerd and readout rules use tokens only (no literal colors), so light and dark both apply", () => {
  const rules = css.split("}").filter((r) => /shell-(slot|chip|nerd|readout|primary-btn|dock-tools)/.test(r.split("{")[0]));
  assert.ok(rules.length >= 6);
  for (const r of rules) assert.doesNotMatch(r, /#[0-9a-fA-F]{3,8}\b|rgb\(/, r.split("{")[0].trim());
});

test("the empty legacy controls container takes no room, and the nerd drawer is scrollable", () => {
  assert.match(css, /\.shell \.shell-controls:empty\s*\{[^}]*display:\s*none/);
  assert.match(css, /\.shell \.shell-nerd\s*\{[^}]*overflow:\s*auto/);
});
