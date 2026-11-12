import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

// chronocube.mjs needs a DOM and WebGL, so the init functions cannot run under node. A stale init (its mode was
// replaced while it awaited) must not touch the new mode's DOM or register listeners, so the source is checked:
// every await that runs in an init function's own body is followed directly by an isCurrent() check, and every
// appearance-panel callback is wrapped in whenCurrent().
// The Live Clock lives in src/apps/clock/live-mode.mjs (`mountLiveClock`); `initClockMode` in chronocube.mjs only hands
// the studio contract over to it, so the guard follows the clock into that file.
const parse = (path) => {
  const text = readFileSync(path, "utf8");
  return ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
};
const files = new Map();
const inits = [];
const collect = (path, accept) => {
  const file = parse(path);
  file.forEachChild((node) => {
    if (ts.isFunctionDeclaration(node) && accept(node.name?.text ?? "")) {
      inits.push(node);
      files.set(node, file);
    }
  });
};
collect("src/chronocube.mjs", (name) => /^init[A-Z]\w*Mode$/.test(name) && name !== "initClockMode");
collect("src/apps/clock/live-mode.mjs", (name) => name === "mountLiveClock");
const delegate = readFileSync("src/chronocube.mjs", "utf8");
const isFunctionLike = (n) => ts.isFunctionLike(n);
const isStaleCheck = (stmt, file) =>
  stmt !== undefined &&
  ts.isIfStatement(stmt) &&
  /^!isCurrent\(\)$/.test(stmt.expression.getText(file));

test("the studio has ten mode init functions, each taking isCurrent", () => {
  assert.equal(inits.length, 10); // initHsmSingleMode and initTimerMode each serve several modes; initCiMode and initCalendarMode load their mounts lazily
  assert.match(delegate, /function initClockMode\(isCurrent, params, shell\) \{\s*return mountLiveClock\(clockStudio, params, shell, isCurrent\);/);
  for (const fn of inits)
    assert.ok(
      fn.parameters.some((p) => p.name.getText(files.get(fn)) === "isCurrent"),
      `${fn.name.text} takes isCurrent`,
    );
});

for (const fn of inits) {
  const file = files.get(fn);
  test(`${fn.name.text}: every await in the init body is followed by an isCurrent() check`, () => {
    const awaits = [];
    (function walk(node) {
      if (ts.isAwaitExpression(node)) awaits.push(node);
      node.forEachChild((c) => {
        if (!isFunctionLike(c)) walk(c);
      });
    })(fn.body);
    assert.ok(awaits.length > 0);
    for (const aw of awaits) {
      let stmt = aw;
      while (!(ts.isBlock(stmt.parent) || ts.isSourceFile(stmt.parent))) stmt = stmt.parent;
      const siblings = stmt.parent.statements;
      const next = siblings[siblings.indexOf(stmt) + 1];
      const line = file.getLineAndCharacterOfPosition(aw.getStart(file)).line + 1;
      assert.ok(isStaleCheck(next, file), `${fn.name.text}: await at line ${line} has no isCurrent() check after it`);
    }
  });

  test(`${fn.name.text}: appearance-panel callbacks are wrapped in whenCurrent`, () => {
    (function walk(node) {
      if (ts.isCallExpression(node) && /(^|\.)setupAppearancePanel$/.test(node.expression.getText(file))) {
        const line = file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1;
        assert.match(node.arguments[1].getText(file), /^whenCurrent\(/, `line ${line}`);
      }
      node.forEachChild(walk);
    })(fn.body);
  });
}
