# prettier-plugin-flix

A [Prettier](https://prettier.io) plugin for [Flix](https://flix.dev) source files (`.flix`).

It follows the standard plugin shape: a **parser** (source → AST) and a **printer** (AST → Prettier doc IR).

| Piece | Where | Notes |
| --- | --- | --- |
| Grammar | `grammar/FlixLexer.g4`, `grammar/FlixParser.g4` | Vendored from [`wstein/flix-antlr-grammar`](https://github.com/wstein/flix-antlr-grammar), see [PROVENANCE.md](PROVENANCE.md). |
| Parser | `src/parse.ts` | The `antlr4ng` runtime over the generated lexer and parser. Returns one root node that carries the ANTLR parse tree, the code-point source, and the comment/line-break facts read from the hidden token channels. |
| Printer | `src/print.ts` | Walks the parse tree and builds the doc with `group`, `indent`, `line`, `softline`, `hardline`, `join`, `ifBreak`, `lineSuffix`, `breakParent`. |
| Plugin | `src/index.ts` | `languages`, `parsers.flix` (`astFormat: "flix-ast"`), `printers["flix-ast"]`, `defaultOptions`. |

## Use

```sh
cd tools/prettier-plugin-flix
npm install
npm run build            # generates the parser from grammar/*.g4, then compiles with tsc
npx prettier --plugin=./dist/index.js --write 'path/to/**/*.flix'
```

From another project, install this directory next to Prettier (`npm i -D prettier ./tools/prettier-plugin-flix`) and list it in `.prettierrc`:

```json
{ "plugins": ["prettier-plugin-flix"] }
```

The plugin defaults `tabWidth` to 4, the indentation of the Flix standard library. `printWidth` and `endOfLine` behave as in Prettier core.

## What it formats

- Declarations: `mod`, `def`, `val`, `enum`, `struct`, `trait`, `instance`, `eff`, `type alias`, annotations and modifiers.
- Expressions: calls, method calls, operator chains (wrapped after the operator), lambdas, `if`/`else`, `match`/`choose`/`select`, `let` chains, `foreach`/`forM`/`forA`, `try`/`catch`, `run`/`with`, `region`, records, collections, Datalog constraint sets, string interpolation.
- Types and patterns, including effect annotations (`\ IO`), kinds, record, schema and case-set types.
- Comments (`//`, `///`, `/* */`) are kept next to the token they were written beside; blank lines between items are preserved (at most one).

Layout decisions that depend on the source are deliberate, so that formatting is stable: a block, record, or member list that spans several lines in the source stays multi-line; one written on a single line is collapsed or wrapped only by width.

## Whitespace-sensitive tokens

Flix classifies some tokens by the whitespace around them (`->` in `s->field` versus a lambda arrow, `.` in `a.b`, `::` in `use A::B`). The printer never moves those tokens across a boundary that changes their class: field access and method dots never break, and `use Pkg::Name` stays tight.

## Verification

`npm test` builds the plugin and runs `test/*.test.mjs`. For every `.flix` file it checks that the formatted output

1. parses without errors,
2. has the same significant token texts (optional trailing commas aside) and the same comments,
3. has the same parse-tree shape, and
4. formats to itself (idempotence).

To run the same checks over any directory:

```sh
node scripts/check-corpus.mjs <dir-or-file>...
```

## Limits

- The parser is the permissive Flix grammar: it accepts some programs the compiler later rejects. The plugin formats what parses; it does not validate.
- Parse errors are reported with line and column and nothing is printed.
- Very long method chains cannot wrap before a `.`, because a dot preceded by whitespace is a different token.
- No `// prettier-ignore` support yet.
