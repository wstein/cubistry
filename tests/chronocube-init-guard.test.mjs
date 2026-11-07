import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

// chronocube.mjs needs a DOM and WebGL, so the init functions cannot run under node. A stale init (its mode was
// replaced while it awaited) must not touch the new mode's DOM or register listeners, so the source is checked:
// every await that runs in an init function's own body is followed directly by an isCurrent() check, and every
// appearance-panel callback is wrapped in whenCurrent().
const source = readFileSync("src/chronocube.mjs", "utf8");
const file = ts.createSourceFile("chronocube.mjs", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const inits = [];
file.forEachChild(function visit(node) {
  if (ts.isFunctionDeclaration(node) && /^init[A-Z]\w*Mode$/.test(node.name?.text ?? "")) inits.push(node);
});
const isFunctionLike = (n) => ts.isFunctionLike(n);
const isStaleCheck = (stmt) =>
  stmt !== undefined &&
  ts.isIfStatement(stmt) &&
  /^!isCurrent\(\)$/.test(stmt.expression.getText(file));

test("the studio has eight mode init functions, each taking isCurrent", () => {
  assert.equal(inits.length, 8); // initHsmSingleMode and initTimerMode each serve several modes
  for (const fn of inits)
    assert.ok(
      fn.parameters.some((p) => p.name.getText(file) === "isCurrent"),
      `${fn.name.text} takes isCurrent`,
    );
});

for (const fn of inits) {
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
      assert.ok(isStaleCheck(next), `${fn.name.text}: await at line ${line} has no isCurrent() check after it`);
    }
  });

  test(`${fn.name.text}: appearance-panel callbacks are wrapped in whenCurrent`, () => {
    (function walk(node) {
      if (ts.isCallExpression(node) && node.expression.getText(file) === "setupAppearancePanel") {
        const line = file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1;
        assert.match(node.arguments[1].getText(file), /^whenCurrent\(/, `line ${line}`);
      }
      node.forEachChild(walk);
    })(fn.body);
  });
}
