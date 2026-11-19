import type { AstPath, Doc, Options, Parser, Plugin, Printer, SupportLanguage } from "prettier";
import { parseFlix, type FlixRoot } from "./parse.js";
import { Printer as FlixPrinter } from "./print.js";

export const languages: SupportLanguage[] = [
    {
        name: "Flix",
        parsers: ["flix"],
        extensions: [".flix"],
        vscodeLanguageIds: ["flix"],
        linguistLanguageId: 0,
    },
];

const flixParser: Parser<FlixRoot> = {
    parse: (text: string) => parseFlix(text),
    astFormat: "flix-ast",
    locStart: (node: FlixRoot) => node.start,
    locEnd: (node: FlixRoot) => node.end,
};

export const parsers: Record<string, Parser<FlixRoot>> = { flix: flixParser };

const flixAstPrinter: Printer<FlixRoot> = {
    // The whole tree is printed from the root: comments and blank lines are read from the
    // token stream, so Prettier's own comment attachment is not used.
    print(path: AstPath<FlixRoot>, _options: Options): Doc {
        return new FlixPrinter(path.node).printRoot();
    },
};

export const printers: Record<string, Printer<FlixRoot>> = { "flix-ast": flixAstPrinter };

// Flix's standard library and compiler use four-space indentation.
export const defaultOptions = { tabWidth: 4 };

const plugin: Plugin<FlixRoot> = { languages, parsers, printers, defaultOptions };
export default plugin;
