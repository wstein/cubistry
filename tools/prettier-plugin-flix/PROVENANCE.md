# Provenance

`grammar/FlixLexer.g4` and `grammar/FlixParser.g4` are copied unmodified from
[`wstein/flix-antlr-grammar`](https://github.com/wstein/flix-antlr-grammar) at commit
`6c1f54a4ef572d6304ee3b72d862d7a60f886c75` (Flix 0.80.0 reference grammar, Apache-2.0; license in
[grammar/LICENSE-flix-antlr-grammar.md](grammar/LICENSE-flix-antlr-grammar.md)).

`src/FlixLexerBase.ts` is copied from the same commit (`antlr-ng/src/FlixLexerBase.ts`), and
`scripts/generate.mjs` is adapted from its `tools/gen-antlr-ng.mjs` (paths only). The lexer and parser
in `src/generated/` are produced by `npm run generate` with `antlr-ng` and are not committed.

To update the grammar, copy the two `.g4` files and `FlixLexerBase.ts` from a newer commit, update the
hash above, and run `npm test`.
