import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import ts from "typescript";

// A mode's init function that names an undeclared variable throws a ReferenceError at runtime, switchMode()
// reports it in #studio-error and never sets #shell[data-mode-ready]. The browser smoke test catches that
// only in the heavy lane, so this check finds such names in src/chronocube.mjs directly.
test("src/chronocube.mjs refers to no undeclared name", () => {
  const file = resolve("src/chronocube.mjs");
  const program = ts.createProgram([file], {
    allowJs: true,
    checkJs: true,
    noEmit: true,
    noResolve: true,
    skipLibCheck: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    lib: ["lib.es2022.d.ts", "lib.dom.d.ts"],
    types: [],
  });
  const source = program.getSourceFile(file);
  const undeclared = program
    .getSemanticDiagnostics(source)
    .filter((d) => d.code === 2304 || d.code === 2552) // Cannot find name / Did you mean
    .map((d) => {
      const { line } = source.getLineAndCharacterOfPosition(d.start);
      return `${line + 1}: ${ts.flattenDiagnosticMessageText(d.messageText, "\n")}`;
    });
  assert.deepEqual(undeclared, []);
});
