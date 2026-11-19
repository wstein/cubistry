import { format } from "prettier";
import { CharStream, CommonTokenStream } from "antlr4ng";
import { FlixLexer } from "../dist/generated/FlixLexer.js";
import { FlixParser } from "../dist/generated/FlixParser.js";
import plugin from "../dist/index.js";

export const fmt = (text, opts = {}) =>
    format(text, { parser: "flix", plugins: [plugin], ...opts });

/** Default-channel token texts plus a parse-tree shape string. */
export function fingerprint(text) {
    const lexer = new FlixLexer(CharStream.fromString(text));
    const stream = new CommonTokenStream(lexer);
    const parser = new FlixParser(stream);
    const errors = [];
    const l = { syntaxError: (_r, _s, line, col, msg) => errors.push(`${line}:${col} ${msg}`), reportAmbiguity() {}, reportAttemptingFullContext() {}, reportContextSensitivity() {} };
    lexer.removeErrorListeners(); lexer.addErrorListener(l);
    parser.removeErrorListeners(); parser.addErrorListener(l);
    const tree = parser.compilationUnit();
    stream.fill();
    const tokens = stream.getTokens().filter((t) => t.channel === 0 && t.type !== FlixLexer.EOF).map((t) => t.text);
    const comments = stream.getTokens().filter((t) => t.channel >= 2).map((t) => t.text.trim());
    const shape = (n) => (n.children ? `${n.constructor.name}(${n.children.map(shape).join(",")})` : "t");
    return { errors, tokens, comments, shape: shape(tree) };
}

/** Optional trailing commas may legitimately vanish when a list fits on one line. */
export const dropTrailingCommas = (tokens) =>
    tokens.filter((t, i) => !(t === "," && [")", "]", "}"].includes(tokens[i + 1])));
