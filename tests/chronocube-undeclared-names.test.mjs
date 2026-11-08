import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import ts from "typescript";

// A mode's init function that names an undeclared variable or calls a method its class does not have throws at
// runtime. switchMode() reports the error in #studio-error and never sets #shell[data-mode-ready], or the click
// or submit handler throws. The browser smoke test finds only part of that, and only in the heavy lane, so this
// check type-checks the host and the extracted clock mount against the real imported classes.
const NAME_CODES = new Set([2304, 2552]); // Cannot find name / Did you mean (name)
const MEMBER_CODES = new Set([2339, 2551]); // Property does not exist / Did you mean (property)
// The file reads form controls through $(id), typed as HTMLElement; those properties exist at runtime.
// Only 2339 is excused: 2551 means a close spelling exists on the type, which points at a typo.
const DOM_TYPE = /on type '(?:HTML\w*Element|Element|EventTarget|Event|Node|ImportMeta)'/;

for (const path of ["src/chronocube.mjs", "src/apps/clock/live-mode.mjs"])
test(`${path} uses no undeclared name and no missing method or property`, () => {
  const file = resolve(path);
  const program = ts.createProgram([file], {
    allowJs: true,
    checkJs: true,
    noEmit: true,
    skipLibCheck: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    allowImportingTsExtensions: true,
    resolveJsonModule: true,
    lib: ["lib.es2022.d.ts", "lib.dom.d.ts"],
    types: [],
  });
  const source = program.getSourceFile(file);
  const problems = program
    .getSemanticDiagnostics(source)
    .filter((d) => {
      const message = ts.flattenDiagnosticMessageText(d.messageText, "\n");
      return NAME_CODES.has(d.code) || (MEMBER_CODES.has(d.code) && !(d.code === 2339 && DOM_TYPE.test(message)));
    })
    .map((d) => {
      const { line } = source.getLineAndCharacterOfPosition(d.start);
      return `${line + 1}: ${ts.flattenDiagnosticMessageText(d.messageText, "\n").split("\n")[0]}`;
    });
  assert.deepEqual(problems, []);
});
