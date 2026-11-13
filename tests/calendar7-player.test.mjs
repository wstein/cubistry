// SPDX-License-Identifier: AGPL-3.0-or-later
// English 7x7 calendar cube, stage 2: step player, move tween, sticker art and the 3D mount (research candidate, not
// certified). Deterministic: a fake view and a fake DOM, no WebGL, no timers, no network.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { contrast } from "./calendar7-contrast.mjs";
import { expand, groupBlocks } from "../src/apps/calendar7/blocks.ts";
import { applyMoves, clonePose, inverseMoves, samePose, stateDigest } from "../src/apps/calendar7/engine.ts";
import { parseDisplays, parseGraph, parseState } from "../src/apps/calendar7/graph.ts";
import { alignmentText, playedBlocks } from "../src/apps/calendar7/deferral.ts";
import { href, monthLabel } from "../src/apps/calendar7/month-view.ts";
import { Calendar7Player, DEFAULT_SPEED, SPEEDS, StateMismatchError } from "../src/apps/calendar7/player.ts";
import { MoveTween, smoothstep } from "../src/apps/calendar7/tween.ts";
import { BLANK_PAPER, INK_COLORS, PAPER, TEXTURE, drawSticker } from "../src/apps/calendar7/sticker-art.ts";
import { SCHEMES } from "../src/apps/calendar7/schemes.ts";
import { mountCalendar7 } from "../src/apps/calendar7/mount.ts";

const json = (p) => JSON.parse(readFileSync(p, "utf8"));
const graph = parseGraph(json("public/calendar7/graph.v1.json"));
const table = parseDisplays(json("public/calendar7/displays.v1.json"));
const start = parseState(json("public/calendar7/state.v1.json"));
const { printing, pose: rootPose } = start;
const LAST = graph.nodes.length - 1;
const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};
const digest = (pose) => stateDigest(printing, pose);

/** A view whose turns finish at once, or when the test says so. */
function fakeView({ manual = false } = {}) {
  const log = { turns: [], shows: [] };
  const pending = [];
  return {
    log,
    pending,
    show(pose) {
      log.shows.push(clonePose(pose));
      while (pending.length) pending.shift()(); // an interrupted turn resolves
    },
    turn(block, before, ms) {
      log.turns.push({ block, before: clonePose(before), ms });
      if (!manual) return Promise.resolve();
      return new Promise((resolve) => pending.push(resolve));
    },
  };
}
const makePlayer = (over = {}) => {
  const view = over.view ?? fakeView();
  const changes = [];
  const errors = [];
  const player = new Calendar7Player({
    graph,
    printing,
    root: rootPose,
    view,
    reducedMotion: () => false,
    onChange: (s) => changes.push(s),
    onError: (e) => errors.push(e),
    ...over,
  });
  return { player, view, changes, errors };
};
const settle = async (player) => {
  for (let i = 0; i < 100000 && player.snapshot.status === "playing"; i++) await Promise.resolve();
};

test("the root pose digest is the stored hash of node 0 and the speeds are offered", () => {
  assert.equal(digest(rootPose), graph.nodes[0].hash);
  assert.ok(SPEEDS.includes(DEFAULT_SPEED));
  assert.equal(LAST, 883);
});

test("a sample of steps, forward and backward, ends on the stored hash of the target node and plays the stored word", async () => {
  // Chain start, a middle pair, the last edge, and back from the end.
  for (const [from, to] of [[0, 1], [1, 0], [100, 101], [101, 100], [300, 301], [LAST - 1, LAST], [LAST, LAST - 1], [1, 2]]) {
    const { player, view } = makePlayer();
    player.jump(from);
    assert.equal(digest(player.shownPose), graph.nodes[from].hash, `start ${from}`);
    player.go(to);
    assert.equal(player.snapshot.status, "playing");
    await settle(player);
    const word = to > from ? graph.edges[from].moves : inverseMoves(graph.edges[to].moves);
    const blocks = groupBlocks(word);
    assert.equal(view.log.turns.length, blocks.length, `blocks ${from}->${to}`);
    assert.deepEqual(view.log.turns.map((t) => t.block), blocks);
    // Every turn starts from the pose the previous blocks produced.
    for (const i of [0, Math.floor(blocks.length / 2), blocks.length - 1])
      assert.ok(samePose(view.log.turns[i].before, applyMoves(makeStart(from), expand(blocks.slice(0, i)))), `before ${i}`);
    assert.equal(player.snapshot.status, "idle");
    assert.equal(player.snapshot.index, to);
    assert.equal(digest(player.shownPose), graph.nodes[to].hash, `end ${to}`);
  }
});
/** The pose of node k by plain engine replay from the root (computed once, independently of the player). */
const NODE_POSES = [rootPose];
for (const e of graph.edges) NODE_POSES.push(applyMoves(NODE_POSES.at(-1), e.moves));
const makeStart = (k) => NODE_POSES[k];

test("the whole chain forward and back: the shown pose equals the stored hash after every animated step", async () => {
  const { player } = makePlayer();
  player.jump(0);
  for (let k = 1; k <= LAST; k++) {
    player.go(k);
    await settle(player);
    assert.equal(digest(player.shownPose), graph.nodes[k].hash, `forward to ${k}`);
  }
  assert.throws(() => player.go(LAST + 1), RangeError, "no node after the end");
  for (let k = LAST - 1; k >= 0; k--) {
    player.go(k);
    await settle(player);
    assert.equal(digest(player.shownPose), graph.nodes[k].hash, `back to ${k}`);
  }
  assert.ok(samePose(player.shownPose, rootPose));
});

test("jumping to a far month walks the stored edges and equals the stored hash; first display needs no step", () => {
  const { player, view } = makePlayer();
  player.go(250); // nothing shown yet: a jump
  assert.equal(view.log.turns.length, 0);
  assert.equal(view.log.shows.length, 1);
  assert.equal(digest(player.shownPose), graph.nodes[250].hash);
  player.go(40); // not adjacent: a jump
  assert.equal(view.log.turns.length, 0);
  assert.equal(digest(player.shownPose), graph.nodes[40].hash);
  assert.throws(() => player.jump(-1), RangeError);
  assert.throws(() => player.jump(LAST + 1), RangeError);
});

test("reduced motion: a step jumps to its end state at once, with no turn and the digest checked", () => {
  const { player, view, changes } = makePlayer({ reducedMotion: () => true });
  player.go(10);
  player.go(11);
  player.go(10);
  assert.equal(view.log.turns.length, 0, "no animation");
  assert.equal(view.log.shows.length, 3);
  assert.equal(player.snapshot.status, "idle");
  assert.equal(digest(player.shownPose), graph.nodes[10].hash);
  assert.ok(changes.every((c) => c.status === "idle" && c.total === 0));
});

test("skip to the end finishes the step at once: end state equals the stored hash and the loop stops", async () => {
  const view = fakeView({ manual: true });
  const { player } = makePlayer({ view });
  player.jump(20);
  player.go(21);
  await flush();
  assert.equal(view.log.turns.length, 1, "the first move is in flight");
  const shows = view.log.shows.length;
  player.skip();
  assert.equal(view.log.shows.length, shows + 1);
  assert.ok(samePose(view.log.shows.at(-1), makeStart(21)));
  await flush();
  assert.equal(view.log.turns.length, 1, "no further move after skipping");
  assert.equal(player.snapshot.status, "idle");
  assert.equal(player.snapshot.index, 21);
  assert.equal(digest(player.shownPose), graph.nodes[21].hash);
});

test("Previous/Next during a step: the step is brought to its end state, then the next one starts from it", async () => {
  const view = fakeView({ manual: true });
  const { player } = makePlayer({ view });
  player.jump(30);
  player.go(31);
  await flush();
  // Finish three moves, then ask for the month after.
  for (let i = 0; i < 3; i++) {
    view.pending.shift()();
    await flush();
  }
  assert.equal(player.snapshot.done, 3);
  player.go(32);
  assert.equal(digest(player.shownPose), graph.nodes[31].hash, "the interrupted step is complete");
  await flush();
  assert.equal(player.snapshot.from, 31);
  assert.equal(player.snapshot.index, 32);
  assert.equal(player.snapshot.done, 0);
  assert.deepEqual(view.log.turns.at(-1).block, groupBlocks(graph.edges[31].moves)[0]);
  player.skip();
  assert.equal(digest(player.shownPose), graph.nodes[32].hash);
  // And backwards from the middle of a step.
  player.go(31);
  await flush();
  view.pending.shift()();
  await flush();
  player.go(32);
  assert.equal(digest(player.shownPose), graph.nodes[31].hash);
  player.skip();
  assert.equal(digest(player.shownPose), graph.nodes[32].hash);
});

test("pause stops after the move in flight, play resumes, the word is played exactly once", async () => {
  const view = fakeView({ manual: true });
  const { player } = makePlayer({ view });
  player.jump(5);
  player.go(6);
  await flush();
  player.pause();
  assert.equal(player.snapshot.status, "paused");
  view.pending.shift()();
  await flush();
  assert.equal(view.log.turns.length, 1, "no new move while paused");
  assert.equal(player.snapshot.done, 1);
  player.pause(); // idempotent
  player.play();
  player.play(); // idempotent: one loop only
  await flush();
  assert.equal(view.log.turns.length, 2);
  while (player.snapshot.status === "playing") {
    view.pending.shift()?.();
    await flush();
  }
  const blocks = groupBlocks(graph.edges[5].moves);
  assert.equal(view.log.turns.length, blocks.length);
  assert.deepEqual(view.log.turns.map((t) => t.block), blocks);
  assert.equal(digest(player.shownPose), graph.nodes[6].hash);
});

test("speed changes the move duration; unknown speeds are refused", async () => {
  const { player, view } = makePlayer();
  player.jump(7);
  player.setSpeed(1000);
  player.go(8);
  await settle(player);
  player.setSpeed(100);
  player.go(9);
  await settle(player);
  const first = view.log.turns[0];
  const last = view.log.turns.at(-1);
  assert.equal(first.ms, 1000 * Math.abs(first.block.angle));
  assert.equal(last.ms, 100 * Math.abs(last.block.angle));
  assert.throws(() => player.setSpeed(300), RangeError);
});

test("a stored hash that differs from the pose is an error, never a silent mismatch", async () => {
  const bad = { ...graph, nodes: graph.nodes.map((n, i) => (i === 12 ? { ...n, hash: "0".repeat(64) } : n)) };
  const a = makePlayer({ graph: bad });
  assert.throws(() => a.player.jump(12), StateMismatchError);
  const b = makePlayer({ graph: bad });
  b.player.jump(11);
  b.player.go(12);
  await settle(b.player);
  assert.equal(b.errors.length, 1);
  assert.ok(b.errors[0] instanceof StateMismatchError);
  const c = makePlayer({ graph: bad });
  c.player.jump(11);
  c.player.go(12);
  assert.throws(() => c.player.skip(), StateMismatchError);
});

test("dispose ends the loop: a turn that resolves afterwards changes nothing and starts nothing", async () => {
  const view = fakeView({ manual: true });
  const { player, changes } = makePlayer({ view });
  player.jump(3);
  player.go(4);
  await flush();
  const before = changes.length;
  player.dispose();
  view.pending.shift()();
  await flush();
  assert.equal(view.log.turns.length, 1);
  assert.equal(changes.length, before, "no notification after dispose");
  const shows = view.log.shows.length;
  player.go(5);
  player.jump(9);
  player.play();
  assert.equal(view.log.shows.length, shows, "a disposed player does not touch the view");
});

test("MoveTween: eased progress over the given time, one end, cancel resolves at once", async () => {
  const tween = new MoveTween();
  const seen = [];
  const ends = [];
  const done = tween.begin(100, (p) => seen.push(p), (c) => ends.push(c), 1000);
  assert.equal(tween.running, true);
  assert.equal(tween.tick(1000), true);
  assert.equal(seen[0], 0);
  tween.tick(1050);
  assert.equal(seen[1], smoothstep(0.5));
  tween.tick(1200);
  assert.equal(seen.at(-1), 1);
  assert.deepEqual(ends, [true]);
  await done;
  assert.equal(tween.running, false);
  assert.equal(tween.tick(1300), false, "an idle tween asks for no frame");
  // A move shorter than a frame ends on the first frame after it began.
  const e0 = [];
  const quick = tween.begin(11, () => {}, (c) => e0.push(c), 5000);
  tween.tick(5017);
  await quick;
  assert.deepEqual(e0, [true]);
  // Cancel: the end callback runs with false and the promise resolves without a frame.
  const e2 = [];
  const p2 = tween.begin(100, () => {}, (c) => e2.push(c), 0);
  tween.cancel();
  await p2;
  assert.deepEqual(e2, [false]);
  // A new tween replaces a running one.
  const e3 = [];
  const first = tween.begin(100, () => {}, (c) => e3.push(["first", c]), 0);
  const second = tween.begin(100, () => {}, (c) => e3.push(["second", c]), 0);
  await first;
  assert.deepEqual(e3, [["first", false]]);
  tween.cancel();
  await second;
});

test("sticker art: every ink reads on the paper at 4.5:1, text is fitted into the sticker, blank is plain paper", () => {
  for (const [ink, color] of Object.entries(INK_COLORS)) assert.ok(contrast(color, PAPER) >= 4.5, `${ink} ${contrast(color, PAPER).toFixed(2)}`);
  const run = (text, ink) => {
    const calls = { fills: [], texts: [], fonts: [] };
    const ctx = {
      set fillStyle(v) {
        calls.fills.push(v);
      },
      set font(v) {
        calls.fonts.push(v);
      },
      fillRect: () => calls.fills.push("rect"),
      fillText: (t, x, y) => calls.texts.push([t, x, y]),
      measureText: (t) => ({ width: calls.fonts.at(-1).match(/(\d+)px/)[1] * 0.6 * t.length }),
      textAlign: "",
      textBaseline: "",
    };
    drawSticker(ctx, text, ink);
    return calls;
  };
  const blank = run("", "blank");
  assert.deepEqual(blank.fills, [BLANK_PAPER, "rect"]);
  assert.deepEqual(blank.texts, []);
  for (const [text, ink] of [["7", "dark"], ["28", "red"], ["SUN", "red"], ["MON", "weekday"], ["23/30", "red"], ["J", "month"]]) {
    const c = run(text, ink);
    assert.equal(c.fills[0], PAPER);
    assert.ok(c.fills.includes(INK_COLORS[ink]));
    assert.equal(c.texts.length, text.includes("/") ? 2 : 1);
    const size = Number(c.fonts.at(-1).match(/(\d+)px/)[1]);
    assert.ok(size * 0.6 * (text.includes("/") ? 2 : text.length) <= TEXTURE * 0.9, `${text} fits (${size}px)`);
  }
  // Every text of the printing is drawn with a known ink.
  for (let i = 0; i < printing.text.length; i++)
    assert.ok(printing.text[i] === "" ? printing.ink[i] === "blank" : INK_COLORS[printing.ink[i]], `sticker ${i + 1}`);
});

// ---- the mount with a fake DOM and a fake stage ----

class El {
  constructor(attrs = {}) {
    this.attrs = { ...attrs };
    this.textContent = "";
    this.hidden = false;
    this.disabled = false;
    this.value = "";
    this.innerHTML = "";
    this.focused = 0;
  }
  querySelector() {
    return { focus: () => this.focused++ };
  }
  setAttribute(k, v) {
    this.attrs[k] = String(v);
    if (k === "hidden") this.hidden = true;
    if (k === "disabled") this.disabled = true;
  }
  removeAttribute(k) {
    delete this.attrs[k];
    if (k === "hidden") this.hidden = false;
  }
  getAttribute(k) {
    return this.attrs[k] ?? null;
  }
  focus() {
    this.focused++;
  }
}
const mountedGraph = parseGraph(json("public/calendar7/chain-c/graph.v1.json"));
/** Index of May 2026 in the chain graph (January 1980 is node 0): the tests were written for a window that started there. */
const MAY_2026 = (2026 - 1980) * 12 + 4;
function fakeRoot() {
  const listeners = { click: new Set(), change: new Set(), submit: new Set() };
  const els = new Map();
  const view = new El();
  const live = new El();
  const get = (name) => {
    if (!els.has(name)) els.set(name, new El({ "data-c7": name }));
    return els.get(name);
  };
  const root = {
    attrs: {},
    set innerHTML(html) {
      this.html = html;
    },
    querySelector(sel) {
      if (sel === ".c7-view") return view;
      if (sel === ".c7-live") return live;
      const m = sel.match(/^\[data-c7="([a-z-]+)"\]$/);
      return m ? get(m[1]) : null;
    },
    contains: () => true,
    addEventListener: (t, l) => listeners[t].add(l),
    removeEventListener: (t, l) => listeners[t].delete(l),
    setAttribute(k, v) {
      this.attrs[k] = String(v);
    },
    getAttribute(k) {
      return this.attrs[k] ?? null;
    },
    view,
    live,
    el: get,
    listeners,
    count: () => listeners.click.size + listeners.change.size,
    clickLink(h) {
      let prevented = false;
      const a = { getAttribute: () => h };
      for (const l of [...listeners.click]) l({ target: { closest: (s) => (s === "a.c7-nav" ? a : null) }, preventDefault: () => (prevented = true) });
      return prevented;
    },
    press(name) {
      const el = get(name);
      for (const l of [...listeners.click]) l({ type: "click", target: { closest: (s) => (s === "a.c7-nav" ? null : el) }, preventDefault() {} });
    },
    choose(name, value) {
      const el = get(name);
      el.value = value;
      for (const l of [...listeners.change]) l({ type: "change", target: { closest: (s) => (s === "a.c7-nav" ? null : el) } });
    },
  };
  return root;
}
function fakeStage(opts) {
  const view = fakeView(opts);
  const stage = {
    ...view,
    configured: 0,
    destroyed: 0,
    labels: [],
    resets: 0,
    surfaces: [],
    schemes: [],
    setScheme: (id) => stage.schemes.push(id),
    homePoses: [],
    setHomePose: (pose) => { stage.homePoses.push(pose); stage.order.push("home"); },
    order: [],
    configure(_printing, _pose, surface) {
      stage.order.push("configure");
      stage.schemes.push("configure");
      stage.configured++;
      stage.surfaces.push(surface);
    },
    setLabel: (t) => stage.labels.push(t),
    resetView: () => stage.resets++,
    destroy: () => stage.destroyed++,
  };
  return stage;
}
const mountEnv = (over = {}) => {
  const stage = over.stage ?? fakeStage();
  const host = { hidden: false };
  const calls = { query: [], created: 0 };
  const env = {
    base: "/",
    fetchJson: async (url) =>
      url.endsWith("graph.v1.json") ? json("public/calendar7/chain-c/graph.v1.json") : url.endsWith("state.v1.json") ? json("public/calendar7/chain-c/state.v1.json") : url.endsWith("best-effort.v1.json") ? json("public/calendar7/chain-c/best-effort.v1.json") : json("public/calendar7/chain-c/displays.v1.json"),
    now: () => new Date(2026, 10, 7),
    search: () => "?app=calendar7&year=2027&month=3",
    replaceQuery: (s) => calls.query.push(s),
    isCurrent: () => true,
    sceneHost: () => host,
    createStage: async () => {
      calls.created++;
      return stage;
    },
    reducedMotion: () => false,
    ...over,
  };
  return { env, stage, host, calls };
};
const q = (s) => new URLSearchParams(s);
const idle = async (root) => {
  for (let i = 0; i < 100000 && root.getAttribute("data-c7-state") !== "idle"; i++) await Promise.resolve();
};

test("mount: the identity pose of the names print reaches the stage before each configure (home faces of the Rubik-Tint scheme)", async () => {
  const root = fakeRoot();
  const { env, stage } = mountEnv();
  const inst = await mountCalendar7(root, q("year=2027&month=3&scheme=rubik-tint"), env);
  await idle(root);
  assert.deepEqual(stage.order, ["home", "configure"]);
  const start = parseState(json("public/calendar7/chain-c/state.v1.json"));
  assert.deepEqual([...stage.homePoses[0].normal], [...start.pose.normal]);
  assert.equal(root.getAttribute("data-c7-scheme"), "rubik-tint");
  inst.dispose();
});

test("mount: the scheme parameter reaches the stage before it is configured; setScheme forwards the id", async () => {
  const root = fakeRoot();
  const { env, stage } = mountEnv();
  const inst = await mountCalendar7(root, q("year=2027&month=3&scheme=paper-blue"), env);
  await idle(root);
  assert.deepEqual(stage.schemes, ["paper-blue", "configure"]);
  assert.equal(root.getAttribute("data-c7-scheme"), "paper-blue");
  inst.setScheme("dracula");
  assert.equal(root.getAttribute("data-c7-scheme"), "dracula");
  inst.setScheme(null);
  assert.deepEqual(stage.schemes.slice(2), ["dracula", null]);
  assert.equal(root.getAttribute("data-c7-scheme"), "paper-red"); // null: the default scheme
  inst.dispose();
  // No parameter: the stage gets null (the default scheme).
  const second = mountEnv();
  const root2 = fakeRoot();
  const inst2 = await mountCalendar7(root2, q("year=2027&month=3"), second.env);
  await idle(root2);
  assert.deepEqual(second.stage.schemes.slice(0, 1), [null]);
  inst2.dispose();
});

test("mount with a 3D view: the shown digest equals the stored hash for the URL month and after each step, both ways", async () => {
  const root = fakeRoot();
  const { env, stage, host, calls } = mountEnv();
  const inst = await mountCalendar7(root, q("year=2027&month=3"), env);
  await idle(root);
  assert.equal(calls.created, 1);
  assert.equal(stage.configured, 1);
  assert.equal(host.hidden, false);
  assert.equal(root.getAttribute("data-c7-month"), "2027-03");
  assert.equal(root.getAttribute("data-c7-digest"), mountedGraph.nodes[10 + MAY_2026].hash);
  assert.match(stage.labels.at(-1), /March 2027/);
  // Next, then Previous twice, then to the chain start.
  for (const [month, k] of [[4, 3], [3, 2], [2, 1], [1, 0]]) {
    assert.equal(root.clickLink(href({ year: 2027, month })), true);
    await flush();
    await idle(root);
    assert.equal(root.getAttribute("data-c7-digest"), mountedGraph.nodes[k + 8 + MAY_2026].hash, `month ${month}`);
    assert.equal(root.getAttribute("data-c7-month"), `2027-0${month}`);
  }
  assert.ok(stage.log.turns.length > 100, "the steps were played move by move");
  assert.match(root.live.textContent, /The cube has turned to January 2027/);
  assert.equal(calls.created, 1, "the stage is built once");
  inst.dispose();
});

test("mount: Play/Pause, Skip to end and Speed drive the player; Previous/Next during a step jumps to its end", async () => {
  const root = fakeRoot();
  const stage = fakeStage({ manual: true });
  const view = stage;
  const { env } = mountEnv({ stage });
  const inst = await mountCalendar7(root, q("year=2027&month=1"), env);
  await idle(root);
  root.choose("orientation", "after");
  assert.equal(root.el("play").getAttribute("aria-disabled") === "true", true, "nothing to play yet");
  root.clickLink(href({ year: 2027, month: 2 }));
  await flush();
  assert.equal(root.el("play").textContent, "Pause");
  assert.equal(root.el("skip").getAttribute("aria-disabled") === "true", false);
  assert.match(root.el("progress").textContent, new RegExp(`^Turning to February 2027: move 1 of ${playedBlocks(mountedGraph.edges[8 + MAY_2026].moves, { slice: true, defer: true }).blocks.length}$`));
  root.press("play"); // pause
  assert.equal(root.el("play").textContent, "Play");
  root.choose("speed", "1000");
  assert.equal(root.el("speed").value, "1000");
  root.press("play"); // resume
  assert.equal(root.el("play").textContent, "Pause");
  root.press("skip");
  assert.equal(root.getAttribute("data-c7-digest"), mountedGraph.nodes[9 + MAY_2026].hash);
  assert.match(root.el("progress").textContent, /The cube shows February 2027/);
  // A link during a step: the step ends at once and the next one plays.
  root.clickLink(href({ year: 2027, month: 3 }));
  await flush();
  root.clickLink(href({ year: 2027, month: 2 }));
  await flush();
  assert.match(root.el("progress").textContent, /Turning to February 2027/);
  root.press("reset");
  assert.equal(stage.resets, 1);
  inst.dispose();
});

test("mount: the middle slice option plays rule-c blocks (rotations deferred) by default; switching it off plays the plain blocks of the next step", async () => {
  const root = fakeRoot();
  const stage = fakeStage({ manual: true });
  const { env } = mountEnv({ stage });
  const inst = await mountCalendar7(root, q("year=2027&month=1"), env);
  await idle(root);
  root.choose("orientation", "after");
  assert.match(root.html, /data-c7="slice" checked/, "the option is offered and on");
  const [first, second] = [mountedGraph.edges[8 + MAY_2026].moves, mountedGraph.edges[9 + MAY_2026].moves];
  root.clickLink(href({ year: 2027, month: 2 }));
  await flush();
  assert.match(root.el("progress").textContent, new RegExp(`move 1 of ${playedBlocks(first, { slice: true, defer: true }).blocks.length}$`));
  root.press("skip");
  assert.equal(root.getAttribute("data-c7-state"), "idle");
  root.el("slice").checked = false;
  root.choose("slice", "");
  root.clickLink(href({ year: 2027, month: 3 }));
  await flush();
  assert.match(root.el("progress").textContent, new RegExp(`move 1 of ${playedBlocks(second, { defer: true }).blocks.length}$`), "plain blocks of the next step");
  root.press("skip");
  assert.equal(root.getAttribute("data-c7-digest"), mountedGraph.nodes[10 + MAY_2026].hash);
  root.el("slice").checked = true;
  root.choose("slice", "");
  root.clickLink(href({ year: 2027, month: 2 }));
  await flush();
  assert.match(root.el("progress").textContent, new RegExp(`move 1 of ${playedBlocks(inverseMoves(second), { slice: true, defer: true }).blocks.length}$`));
  root.press("skip");
  assert.equal(root.getAttribute("data-c7-digest"), mountedGraph.nodes[9 + MAY_2026].hash);
  inst.dispose();
});

test("mount: After moves is available; the alignment is shown apart from the progress; switching it off keeps the stored rotations", async () => {
  const root = fakeRoot();
  const stage = fakeStage({ manual: true });
  const { env } = mountEnv({ stage });
  const inst = await mountCalendar7(root, q("year=2027&month=1"), env);
  await idle(root);
  root.choose("orientation", "after");
  assert.match(root.html, /value="after">After moves/);
  assert.equal(root.el("alignment").hidden, true);
  const aligned = playedBlocks(mountedGraph.edges[8 + MAY_2026].moves, { slice: true, defer: true });
  root.clickLink(href({ year: 2027, month: 2 }));
  await flush();
  assert.equal(root.el("alignment").textContent, `Orientation at the end (free): ${alignmentText(aligned.alignment)}.`);
  assert.ok(stage.log.turns.every((t) => t.block.kind !== "rotation"), "no rotation mid-word");
  root.press("skip");
  assert.equal(root.el("alignment").hidden, true);
  assert.equal(root.getAttribute("data-c7-digest"), mountedGraph.nodes[9 + MAY_2026].hash);
  root.choose("orientation", "stored");
  root.clickLink(href({ year: 2027, month: 3 }));
  await flush();
  assert.match(root.el("progress").textContent, /whole-cube rotation \(free\)|move 1 of/);
  assert.equal(root.el("alignment").textContent, "Whole-cube rotations stay in the word (free).");
  root.press("skip");
  assert.equal(root.getAttribute("data-c7-digest"), mountedGraph.nodes[10 + MAY_2026].hash);
  inst.dispose();
});

test("mount under reduced motion: no animation, the controls say so, the state is still the stored one", async () => {
  const root = fakeRoot();
  const { env, stage } = mountEnv({ reducedMotion: () => true });
  const inst = await mountCalendar7(root, q("year=2027&month=1"), env);
  await idle(root);
  root.clickLink(href({ year: 2027, month: 2 }));
  await flush();
  await idle(root);
  assert.equal(stage.log.turns.length, 0);
  assert.equal(root.getAttribute("data-c7-digest"), mountedGraph.nodes[9 + MAY_2026].hash);
  assert.equal(root.el("note").hidden, false);
  assert.equal(root.el("play").getAttribute("aria-disabled") === "true", true);
  assert.equal(root.el("skip").getAttribute("aria-disabled") === "true", true);
  assert.equal(root.el("speed").disabled, true);
  inst.dispose();
});

test("mount: a month outside the chain builds a display-only preview on the same print; a chain month restores playback", async () => {
  const root = fakeRoot();
  const { env, host, calls } = mountEnv();
  const inst = await mountCalendar7(root, q("year=1979&month=12"), env); // December 1979 is outside
  await flush();
  assert.equal(calls.created, 1);
  assert.equal(host.hidden, false);
  assert.equal(root.el("player").hidden, true);
  root.clickLink(href({ year: 2027, month: 1 }));
  await flush();
  await idle(root);
  assert.equal(host.hidden, false);
  assert.equal(calls.created, 1);
  inst.dispose();
});

test("dispose removes every listener, destroys the stage, stops the loop and restores the scene host", async () => {
  const root = fakeRoot();
  const stage = fakeStage({ manual: true });
  const view = stage;
  const { env, host } = mountEnv({ stage });
  const inst = await mountCalendar7(root, q("year=2027&month=1"), env);
  await idle(root);
  assert.ok(root.count() >= 3);
  root.clickLink(href({ year: 2027, month: 2 }));
  await flush();
  assert.equal(stage.log.turns.length, 1);
  inst.dispose();
  assert.equal(root.count(), 0, "no listener left");
  assert.equal(stage.destroyed, 1);
  assert.equal(host.hidden, false);
  view.pending.shift()?.();
  await flush();
  assert.equal(stage.log.turns.length, 1, "no move after dispose");
});

test("mount respects isCurrent after every await: a stale mount builds nothing and destroys a stage built late", async () => {
  const a = fakeRoot();
  const stale1 = mountEnv({ isCurrent: () => false });
  assert.equal(await mountCalendar7(a, q("year=2027&month=1"), stale1.env), undefined);
  assert.equal(stale1.calls.created, 0);
  assert.equal(stale1.host.hidden, false);
  // The mode is replaced while the stage is being built.
  const b = fakeRoot();
  let current = true;
  const late = mountEnv({
    isCurrent: () => current,
    createStage: async () => {
      current = false;
      return late.stage;
    },
  });
  const inst = await mountCalendar7(b, q("year=2027&month=1"), late.env);
  await flush();
  assert.equal(late.stage.destroyed, 1, "the late stage is destroyed");
  assert.equal(late.stage.configured, 0);
  assert.equal(late.stage.log.shows.length, 0);
  inst.dispose();
  assert.equal(late.stage.destroyed, 1, "and not twice");
});

test("mount: a digest mismatch stops the 3D view for good: scene hidden, controls off, state failed, later steps do not restart it", async () => {
  const root = fakeRoot();
  const tampered = json("public/calendar7/chain-c/graph.v1.json");
  tampered.nodes[9 + MAY_2026].hash = "0".repeat(64);
  const stage = fakeStage();
  const { env, host } = mountEnv({
    stage,
    fetchJson: async (url) => (url.endsWith("graph.v1.json") ? tampered : url.endsWith("state.v1.json") ? json("public/calendar7/chain-c/state.v1.json") : url.endsWith("best-effort.v1.json") ? json("public/calendar7/chain-c/best-effort.v1.json") : json("public/calendar7/chain-c/displays.v1.json")),
  });
  const orig = console.error;
  console.error = () => {};
  try {
    const inst = await mountCalendar7(root, q("year=2027&month=1"), env);
    await idle(root);
    root.choose("orientation", "after");
    root.clickLink(href({ year: 2027, month: 2 }));
    for (let i = 0; i < 100000 && root.getAttribute("data-c7-state") !== "failed"; i++) await Promise.resolve();
    assert.equal(root.getAttribute("data-c7-state"), "failed");
    assert.match(root.el("error").textContent, new RegExp(`no whole-cube orientation turns the cube into the stored state of node ${9 + MAY_2026}`));
    assert.match(root.el("error").textContent, /sheet below/);
    assert.equal(root.el("error").hidden, false);
    assert.equal(host.hidden, true);
    assert.equal(stage.destroyed, 1);
    const turns = stage.log.turns.length;
    root.clickLink(href({ year: 2027, month: 1 }));
    root.press("play");
    await flush();
    assert.match(root.view.innerHTML, /data-month="2027-01"/, "the sheet still follows the month");
    assert.equal(stage.log.turns.length, turns, "no new turn");
    assert.equal(host.hidden, true);
    assert.equal(root.getAttribute("data-c7-state"), "failed");
    inst.dispose();
    assert.equal(stage.destroyed, 1);
  } finally {
    console.error = orig;
  }
});

test("a failing stage (no WebGL) leaves the month sheet and reports the error", async () => {
  const root = fakeRoot();
  const { env, host } = mountEnv({
    createStage: async () => {
      throw new Error("WebGL is not available");
    },
  });
  const orig = console.error;
  console.error = () => {};
  try {
    const inst = await mountCalendar7(root, q("year=2027&month=1"), env);
    await flush();
    assert.match(root.view.innerHTML, /data-month="2027-01"/);
    assert.match(root.el("error").textContent, /WebGL is not available/);
    assert.equal(root.el("error").hidden, false);
    assert.equal(host.hidden, true);
    inst.dispose();
  } finally {
    console.error = orig;
  }
});

test("mount without a 3D environment keeps the canonical sheet and instant date controls without building a stage", async () => {
  const root = fakeRoot();
  const { env } = mountEnv({ sceneHost: undefined, createStage: undefined });
  const fetched = [];
  env.fetchJson = async (u) => (fetched.push(u), json("public" + u));
  const inst = await mountCalendar7(root, q("year=2027&month=1"), env);
  assert.equal(root.listeners.click.size, 1);
  assert.equal(root.listeners.change.size, 0);
  assert.match(root.html, /data-c7-month-picker/);
  assert.equal(fetched.filter((u) => u.includes("state.v1")).length, 1);
  inst.dispose();
  assert.equal(root.count(), 0);
});

// ---- source checks (the viewer needs WebGL, so what cannot run under node is read) ----

const sourceOf = (p) => ts.createSourceFile(p, readFileSync(p, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

test("every await in the mount's own functions is followed by an isCurrent() / alive() check", () => {
  const file = sourceOf("src/apps/calendar7/mount.ts");
  const guarded = [];
  file.forEachChild(function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === "mountCalendar7") guarded.push(node);
  });
  assert.equal(guarded.length, 1);
  const isCheck = (stmt) => stmt !== undefined && ts.isIfStatement(stmt) && /^!(env\.isCurrent|alive)\(\)$/.test(stmt.expression.getText(file));
  let awaits = 0;
  (function walk(node) {
    if (ts.isAwaitExpression(node)) {
      awaits++;
      let stmt = node;
      while (!(ts.isBlock(stmt.parent) || ts.isSourceFile(stmt.parent))) stmt = stmt.parent;
      const siblings = stmt.parent.statements;
      const line = file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1;
      assert.ok(isCheck(siblings[siblings.indexOf(stmt) + 1]), `await at line ${line} has no isCurrent() check after it`);
    }
    node.forEachChild(walk);
  })(guarded[0]);
  assert.ok(awaits >= 3, "the mount awaits the data, the stage and the first step");
});

test("the viewer has one frame loop and releases it, the observer, the rotation and the studio on destroy", () => {
  const text = readFileSync("src/apps/calendar7/viewer.ts", "utf8");
  assert.ok(!/requestAnimationFrame|setInterval|setTimeout/.test(text), "no timers or frame requests of its own");
  assert.equal((text.match(/setAnimationLoop\(/g) ?? []).length, 2, "set once, cleared once");
  const destroy = text.slice(text.indexOf("destroy(): void"));
  for (const call of ["this.tween.cancel()", "setAnimationLoop(null)", "this.resize.disconnect()", "this.rotation.dispose()", "this.studio.dispose()", "this.clear()", "this.renderer.dispose()", "domElement.remove()"])
    assert.ok(destroy.includes(call), call);
  assert.match(text, /@cubistry\/cube-viewer/, "the shared renderer parts are reused");
  assert.match(text, /PhysicalCubeScene/);
});

test("the page text keeps the status: research candidate, not certified, no solver and no jumps", () => {
  const text = readFileSync("src/apps/calendar7/month-view.ts", "utf8");
  assert.match(text, /Research candidate, not certified\. Stage 2/);
  assert.match(text, /No solver and no jumps/);
  assert.equal(monthLabel({ year: 2027, month: 1 }), "January 2027");
  assert.ok(table.displays.length === 91);
});

test("mount always requests stickerless faces while retaining the raw state schema", async () => {
  const state = json("public/calendar7/chain-c/state.v1.json");
  for (const [field, want] of [[{}, "face"], [{ surface: "face" }, "face"], [{ surface: "sticker" }, "face"]]) {
    const { env, stage } = mountEnv({
      fetchJson: async (url) =>
        url.endsWith("graph.v1.json") ? json("public/calendar7/chain-c/graph.v1.json") : url.endsWith("state.v1.json") ? { ...state, ...field } : url.endsWith("best-effort.v1.json") ? json("public/calendar7/chain-c/best-effort.v1.json") : json("public/calendar7/chain-c/displays.v1.json"),
    });
    const inst = await mountCalendar7(fakeRoot(), q("year=2027&month=3"), env);
    await flush();
    assert.deepEqual(stage.surfaces, [want], JSON.stringify(field));
    inst.dispose();
  }
});

test('mount: color theme offers exactly eleven named schemes with Paper Red and URL fallback',async()=>{
 for(const [input,want]of[['','paper-red'],['paper-blue','paper-blue'],['unknown','paper-red']]){
  const root=fakeRoot(),{env}=mountEnv();const inst=await mountCalendar7(root,q(`year=2027&month=3&scheme=${input}`),env);await idle(root);
  assert.match(root.html,/Cube color theme/);
  const html=root.html.match(/<select[^>]+data-c7="scheme"[^>]*>([\s\S]*?)<\/select>/)?.[1];assert(html,'a labeled scheme select exists');
  assert.deepEqual([...html.matchAll(/<option value="([^"]+)"/g)].map(m=>m[1]),SCHEMES.map(s=>s.id));
  assert.equal(SCHEMES.length,11);assert.deepEqual([...html.matchAll(/<option value="([^"]+)" selected>/g)].map(m=>m[1]),[want]);assert.equal(root.el('scheme').value,want);assert.equal(root.getAttribute('data-c7-scheme'),want);inst.dispose();
 }
});
test('mount: color theme changes synchronize stage and picker while preserving unrelated query parameters',async()=>{
 const root=fakeRoot();let search='?app=calendar7&year=2027&month=3&font=nunito&extra=keep';const{env,stage}=mountEnv({search:()=>search,replaceQuery:s=>search=s});
 const inst=await mountCalendar7(root,q(search),env);await idle(root);const before=root.getAttribute('data-c7-digest');
 root.choose('scheme','dracula');assert.equal(stage.schemes.at(-1),'dracula');assert.equal(root.el('scheme').value,'dracula');
 const selected=new URLSearchParams(search);assert.equal(selected.get('scheme'),'dracula');for(const[k,v]of[['year','2027'],['month','3'],['font','nunito'],['extra','keep']])assert.equal(selected.get(k),v);
 const current=search;inst.setScheme('paper-blue');assert.equal(root.el('scheme').value,'paper-blue');assert.equal(stage.schemes.at(-1),'paper-blue');assert.equal(search,current,'the programmatic setter stays in memory');
 inst.setScheme('bad');assert.equal(root.el('scheme').value,'paper-red');assert.equal(root.getAttribute('data-c7-scheme'),'paper-red');
 assert.equal(root.getAttribute('data-c7-digest'),before);assert.equal(stage.configured,1);const n=stage.schemes.length;root.press('scheme');assert.equal(stage.schemes.length,n,'opening a select is not a change');
 inst.dispose();root.choose('scheme','dracula');inst.setScheme('dracula');assert.equal(stage.schemes.length,n,'disposed controls and setters are inert');
});
test('mount: color theme selected while the viewer loads is used on its first configure',async()=>{
 const root=fakeRoot(),stage=fakeStage();let release;const gate=new Promise(r=>release=r);
 const{env}=mountEnv({createStage:()=>gate});const inst=await mountCalendar7(root,q('year=2027&month=3&scheme=paper-blue'),env);
 root.choose('scheme','dracula');assert.equal(root.getAttribute('data-c7-scheme'),'dracula');release(stage);await idle(root);
 assert.deepEqual(stage.schemes,['dracula','configure']);assert.equal(stage.configured,1);inst.dispose();
});

test("mount: a step into the best-effort month February 2026 interrupted by the step out of it never turns the hatched cube", async () => {
  const root = fakeRoot();
  const stage = fakeStage({ manual: true });
  let wrong = [];
  const configure = stage.configure;
  stage.configure = (printing, pose, surface, layout, marked = []) => { wrong = [...marked]; configure(printing, pose, surface); };
  const turn = stage.turn, wrongAtTurn = [];
  stage.turn = (...args) => { wrongAtTurn.push(wrong.length); return turn(...args); };
  const { env } = mountEnv({ stage });
  const inst = await mountCalendar7(root, q("year=2026&month=1"), env);
  await idle(root);
  root.clickLink(href({ year: 2026, month: 2 }));
  await flush();
  assert.equal(root.el("play").textContent, "Pause", "the step into February 2026 is playing");
  root.clickLink(href({ year: 2026, month: 3 })); // the step out of it, while the step in still plays
  await flush();
  for (let i = 0; i < 40 && root.getAttribute("data-c7-state") !== "idle"; i++) { root.press("skip"); await flush(); }
  await idle(root);
  assert.equal(root.getAttribute("data-c7-month"), "2026-03");
  assert.equal(root.getAttribute("data-c7-digest"), mountedGraph.nodes[(2026 - 1980) * 12 + 2].hash);
  assert.ok(wrongAtTurn.length > 0);
  assert.deepEqual(wrongAtTurn.filter((n) => n !== 0), [], "no turn on a cube with the wrong cell");
  assert.deepEqual(wrong, [], "March 2026 has no wrong cell");
  inst.dispose();
});
