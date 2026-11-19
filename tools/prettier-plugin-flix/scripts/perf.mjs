import { readFileSync } from "node:fs";
import { CharStream, CommonTokenStream, PredictionMode, BailErrorStrategy } from "antlr4ng";
import { FlixLexer } from "../dist/generated/FlixLexer.js";
import { FlixParser } from "../dist/generated/FlixParser.js";
const text = readFileSync(process.argv[2], "utf8");
for (const mode of ["SLL"]) {
  for (let r = 0; r < 2; r++) {
    let t = Date.now();
    const lx = new FlixLexer(CharStream.fromString(text)); const st = new CommonTokenStream(lx); st.fill();
    const tl = Date.now() - t; t = Date.now();
    const p = new FlixParser(st);
    p.interpreter.predictionMode = mode === "SLL" ? PredictionMode.SLL : PredictionMode.LL;
    p.removeErrorListeners();
    p.compilationUnit();
    console.log(mode, "lex", tl, "parse", Date.now() - t, "errors", p.numberOfSyntaxErrors);
  }
}
