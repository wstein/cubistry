import { ParserRuleContext, TerminalNode } from "antlr4ng";
import { doc, type Doc } from "prettier";
import { FlixLexer as L } from "./generated/FlixLexer.js";
import type { Comment, FlixRoot, TokenInfo } from "./parse.js";

const { group, indent, line, softline, hardline, join, ifBreak, lineSuffix, breakParent, literalline } = doc.builders;
const { willBreak } = doc.utils;

type Node = ParserRuleContext | TerminalNode;

const isTerm = (n: Node | null | undefined): n is TerminalNode => n instanceof TerminalNode;
const ttype = (t: TerminalNode): number => t.symbol.type;
const kind = (n: Node): string => (isTerm(n) ? "<token>" : n.constructor.name.replace(/Context$/, ""));
const kids = (n: Node): Node[] => (isTerm(n) ? [] : ((n.children ?? []) as Node[]));

function firstTerm(n: Node): TerminalNode | null {
    if (isTerm(n)) return n;
    for (const c of kids(n)) {
        const t = firstTerm(c);
        if (t) return t;
    }
    return null;
}

function lastTerm(n: Node): TerminalNode | null {
    if (isTerm(n)) return n;
    const cs = kids(n);
    for (let i = cs.length - 1; i >= 0; i--) {
        const t = lastTerm(cs[i]);
        if (t) return t;
    }
    return null;
}

/** First terminal that follows `n` in document order. */
function nextTerm(n: Node): TerminalNode | null {
    let cur: Node = n;
    while (cur.parent) {
        const sibs = kids(cur.parent as Node);
        for (let i = sibs.indexOf(cur) + 1; i < sibs.length; i++) {
            const t = firstTerm(sibs[i]);
            if (t) return t;
        }
        cur = cur.parent as Node;
    }
    return null;
}

const OPEN_TO_CLOSE = new Map<number, number>([
    [L.LPAREN, L.RPAREN],
    [L.LBRACK, L.RBRACK],
    [L.LBRACE, L.RBRACE],
    [L.HASH_LBRACE, L.RBRACE],
    [L.HASH_LPAREN, L.RPAREN],
    [L.HASH_BAR, L.BAR_HASH],
]);

const HASH_COLLECTIONS = new Set([L.ARRAY_HASH, L.LIST_HASH, L.MAP_HASH, L.SET_HASH, L.VECTOR_HASH]);

/** Characters that make up user operators; two adjacent runs of them would lex as one token. */
const OP_CHARS = "+-*<>=!&|^$";

/** Brace lists printed without inner padding: `use A.{b, c}`, `List#{1, 2}`. */
const NO_PAD = new Set(["UseClause", "ImportClause", "CollectionLiteral"]);
/** Bracket lists whose items are separated by `;` rather than `,`. */
const SEMI_LISTS = new Set(["ForFragments", "ParYieldExpr"]);
/** Brace lists whose items are whole rules laid out one per line. */
const MEMBERS = new Set([
    "MatchRule", "CatchRule", "HandlerRule", "SelectRule", "NewBody", "EnumCase", "TraitMember",
    "InstanceMember", "OpDeclaration", "Declaration", "UsesOrImports", "DatalogConstraint",
]);
/** Rules shaped `head (= | =>) body`, laid out with the body hugged or indented. */
const EQ_BODY = new Set([
    "DefDeclaration", "ValDeclaration", "AliasDeclaration", "AssocTypeDeclaration", "LocalDefExpr",
    "HandlerRule", "NewBody", "MatchRule", "CatchRule", "SelectRule", "LetExpr", "LambdaExpr",
]);
const BODY_ARROWS = new Set([L.EQUAL, L.ARROW_THICK_R, L.ARROW_WS]);
const BINARY = new Set([
    "UserOpExpr", "AngledPlusExpr", "MultExpr", "AddExpr", "ConsExpr", "CompareExpr", "EqualityExpr",
    "AndExpr", "OrExpr",
]);
/** Own-separator nodes: they emit their trailing space or newline themselves. */
const SELF_SPACED = new Set(["DeclPrefix", "AnnotationList", "ModifierList"]);

const CALL_LIKE = new Set([
    L.NAME_LOWERCASE, L.NAME_UPPERCASE, L.NAME_MATH, L.STATIC_UPPER, L.ANNOTATION, L.HOLE_NAMED,
    L.HOLE_VARIABLE, L.SUPER, L.CHECKED_CAST, L.CHECKED_ECAST, L.UNCHECKED_CAST,
]);

export class Printer {
    private flat = 0;
    private consumed = new Set<number>();
    /** Tokens that start a line in the output, so own-line comments need no extra line break. */
    private lineStart = new Set<number>();

    constructor(private root: FlixRoot) {}

    // ------------------------------------------------------------------ tokens

    private src(t: TerminalNode): string {
        const s = t.symbol;
        if (s.type === L.EOF) return "";
        return this.root.codePoints.slice(s.start, s.stop + 1).join("");
    }

    private info(t: TerminalNode): TokenInfo | undefined {
        return this.root.info.get(t.symbol.tokenIndex);
    }

    private commentText(c: Comment): Doc {
        if (c.isLine) return c.text;
        const lines = c.text.split("\n");
        if (lines.length === 1) return c.text;
        if (lines.slice(1).every((l) => /^\s*\*/.test(l))) {
            return join(hardline, lines.map((l, i) => (i === 0 ? l : " " + l.trim())));
        }
        return join(literalline, lines);
    }

    private leadDoc(info: TokenInfo, closing: boolean): Doc[] {
        const parts: Doc[] = [];
        info.lead.forEach((c, i) => {
            if (i > 0 && c.nl >= 2) parts.push(hardline);
            parts.push(this.commentText(c));
            parts.push(c.isLine || c.nlNext > 0 ? hardline : " ");
        });
        if (info.lead.length > 0 && info.nlAfter >= 2 && !closing) parts.push(hardline);
        return parts;
    }

    private trailDoc(info: TokenInfo): Doc[] {
        return info.trail.map((c) =>
            c.isLine || c.nlNext > 0
                ? [lineSuffix([" ", this.commentText(c)]), breakParent]
                : [" ", this.commentText(c)],
        );
    }

    tok(t: TerminalNode): Doc {
        const info = this.info(t);
        const idx = t.symbol.tokenIndex;
        const parts: Doc[] = [];
        if (info && !this.consumed.has(idx) && info.lead.length > 0) {
            // An own-line comment must start its own line even when a space was planned here.
            if (!this.lineStart.has(idx)) parts.push(hardline);
            parts.push(...this.leadDoc(info, false));
        }
        parts.push(this.src(t));
        if (info) parts.push(...this.trailDoc(info));
        return parts;
    }

    /** Own-line comments in front of a closing token, to be printed inside the block. */
    private takeClosingComments(t: TerminalNode): Doc[] {
        const info = this.info(t);
        if (!info || info.lead.length === 0 || this.consumed.has(t.symbol.tokenIndex)) return [];
        this.consumed.add(t.symbol.tokenIndex);
        const out: Doc[] = [];
        info.lead.forEach((c, i) => {
            if (i > 0 && c.nl >= 2) out.push(hardline);
            out.push(this.commentText(c));
            if (i < info.lead.length - 1) out.push(hardline);
        });
        return out;
    }

    /** Marks the first token of `n` as starting an output line. Call before printing `n`. */
    private ls<T extends Node>(n: T): T {
        const t = firstTerm(n);
        if (t) this.lineStart.add(t.symbol.tokenIndex);
        return n;
    }

    private blankBefore(t: TerminalNode | null): boolean {
        const info = t && this.info(t);
        if (!info) return false;
        return (info.lead.length > 0 ? info.lead[0].nl : info.nlAfter) >= 2;
    }

    private onNewLine(t: TerminalNode | null): boolean {
        const info = t && this.info(t);
        return !!info && info.nlBefore > 0;
    }

    private multiline(n: Node): boolean {
        const a = firstTerm(n);
        const b = lastTerm(n);
        return !!a && !!b && a.symbol.line !== b.symbol.line;
    }

    // ----------------------------------------------------------------- spacing

    private gap(a: TerminalNode, b: TerminalNode, parentKind: string): "" | " " {
        const ta = ttype(a);
        const tb = ttype(b);
        const sa = this.src(a);
        const sb = this.src(b);
        if (OP_CHARS.includes(sa.charAt(sa.length - 1)) && OP_CHARS.includes(sb.charAt(0))) return " ";
        if (tb === L.COMMA || tb === L.SEMI || tb === L.RPAREN || tb === L.RBRACK || tb === L.COLON) return "";
        if (ta === L.LPAREN || ta === L.LBRACK || ta === L.HASH_LPAREN) return "";
        if (ta === L.DOT || ta === L.DOT_WS || tb === L.DOT || tb === L.DOT_WS) return "";
        if (ta === L.HASH || tb === L.HASH) return "";
        if (ta === L.ARROW_TIGHT || tb === L.ARROW_TIGHT) return "";
        if (parentKind === "UseClause" && (ta === L.COLON_COLON_TIGHT || tb === L.COLON_COLON_TIGHT)) return "";
        if (tb === L.LBRACE && HASH_COLLECTIONS.has(ta)) return "";
        if ((tb === L.LPAREN || tb === L.LBRACK) && this.callLike(a)) return "";
        if (parentKind === "SignExpr" && (ta === L.PLUS || ta === L.MINUS)) return "";
        if (parentKind === "UnaryType" && ta === L.TILDE) return "";
        if (parentKind === "InfixCallExpr") {
            if (ta === L.BACKTICK) return this.isOpeningBacktick(a) ? "" : " ";
            if (tb === L.BACKTICK) return this.isOpeningBacktick(b) ? " " : "";
        }
        if (parentKind === "PredicateAndArity" && (ta === L.SLASH || tb === L.SLASH)) return "";
        if (parentKind === "CaseSetType" && (ta === L.ANGLE_L || tb === L.ANGLE_R)) return "";
        if (parentKind === "PrimaryPattern" && ta === L.MINUS) return "";
        return " ";
    }

    private isOpeningBacktick(t: TerminalNode): boolean {
        const sibs = kids(t.parent as Node).filter((c) => isTerm(c) && ttype(c) === L.BACKTICK);
        return sibs[0] === t;
    }

    private callLike(a: TerminalNode): boolean {
        const t = ttype(a);
        if (CALL_LIKE.has(t)) return true;
        const pk = a.parent ? kind(a.parent as Node) : "";
        if (t === L.RPAREN) return pk === "ArgumentList";
        if (t === L.RBRACK) return pk === "IndexExpr" || pk === "TypeArgs";
        // Operator definitions: `def +(a, b)`, `use A.{+}`.
        const gp = a.parent?.parent ? kind(a.parent.parent as Node) : "";
        return pk === "GenericOperator" && (gp === "DefinitionName" || gp === "UseName");
    }

    // ------------------------------------------------------------- sequences

    /** Prints `children` left to right, spacing tokens and grouping bracket pairs. */
    private seq(children: Node[], parentKind: string): Doc {
        const out: Doc[] = [];
        let prevTerm: TerminalNode | null = null;
        let prevChild: Node | null = null;
        let i = 0;
        while (i < children.length) {
            const ch = children[i];
            let piece: Doc;
            let first: TerminalNode | null;
            let last: TerminalNode | null;
            let step = 1;
            const close = isTerm(ch) && OPEN_TO_CLOSE.has(ttype(ch)) ? this.findClose(children, i) : -1;
            if (close > 0) {
                piece = this.delimited(children, i, close, parentKind);
                first = ch as TerminalNode;
                last = children[close] as TerminalNode;
                step = close - i + 1;
            } else {
                piece = isTerm(ch) ? this.tok(ch) : this.print(ch);
                first = firstTerm(ch);
                last = lastTerm(ch);
            }
            if (prevTerm && first && !(prevChild && SELF_SPACED.has(kind(prevChild)))) {
                const g = this.gap(prevTerm, first, parentKind);
                if (g) out.push(g);
            }
            out.push(piece);
            if (last) prevTerm = last;
            prevChild = children[i + step - 1];
            i += step;
        }
        return out;
    }

    private findClose(children: Node[], i: number): number {
        const open = ttype(children[i] as TerminalNode);
        const close = OPEN_TO_CLOSE.get(open)!;
        let depth = 0;
        for (let j = i + 1; j < children.length; j++) {
            const c = children[j];
            if (!isTerm(c)) continue;
            if (ttype(c) === open) depth++;
            else if (ttype(c) === close) {
                if (depth === 0) return j;
                depth--;
            }
        }
        return -1;
    }

    private splitOn(inner: Node[], sep: number): { items: Node[][]; seps: TerminalNode[] } {
        const items: Node[][] = [[]];
        const seps: TerminalNode[] = [];
        for (const n of inner) {
            if (isTerm(n) && ttype(n) === sep) {
                items.push([]);
                seps.push(n);
            } else {
                items[items.length - 1].push(n);
            }
        }
        return { items, seps };
    }

    private joinWithSeps(docs: Doc[], seps: Doc[], after: Doc): Doc[] {
        return docs.flatMap((d, i) => (i < docs.length - 1 ? [d, seps[i], after] : [d]));
    }

    /** Prints `open inner close` with its items laid out as a list or as vertical members. */
    private delimited(children: Node[], i: number, j: number, parentKind: string): Doc {
        const open = children[i] as TerminalNode;
        const close = children[j] as TerminalNode;
        const inner = children.slice(i + 1, j);
        const ot = ttype(open);
        const braces = ot === L.LBRACE || ot === L.HASH_LBRACE || ot === L.HASH_BAR;
        const pad = braces && !NO_PAD.has(parentKind);
        const comments = this.takeClosingComments(close);
        const openDoc = this.tok(open);
        const closeDoc = this.tok(close);

        if (inner.length === 0 && comments.length === 0) return [openDoc, closeDoc];

        const sline = pad ? line : softline;
        const flatSline: Doc = this.flat > 0 ? (pad ? " " : "") : sline;
        const tail: Doc[] = comments.flatMap((c) => [hardline, c]);

        const ruleKids = inner.filter((n) => !isTerm(n));
        const isMembers =
            ot === L.LBRACE &&
            ruleKids.length > 0 &&
            ruleKids.every((n) => MEMBERS.has(kind(n))) &&
            inner.every((n) => !isTerm(n) || ttype(n) === L.COMMA);
        const sourceMultiline = open.symbol.line !== close.symbol.line;

        if (isMembers || (parentKind === "StructDeclaration" && ot === L.LBRACE)) {
            const structSplit = parentKind === "StructDeclaration" ? this.splitOn(inner, L.COMMA) : null;
            const entries = structSplit ? structSplit.items.filter((x) => x.length > 0) : ruleKids.map((n) => [n]);
            const trailingComma = parentKind === "StructDeclaration" && isTerm(inner[inner.length - 1]);
            const entryDocs = entries.map((entry) => this.seq([this.ls(entry[0]), ...entry.slice(1)], kind(entry[0])));
            const docs: Doc[] = [];
            entries.forEach((entry, k) => {
                const node = entry[0];
                if (k > 0) {
                    const blank = this.blankBefore(firstTerm(node));
                    docs.push(sourceMultiline || blank ? hardline : line);
                    if (blank) docs.push(hardline);
                }
                docs.push(entryDocs[k]);
                if (structSplit && (k < entries.length - 1 || trailingComma)) docs.push(this.tok(structSplit.seps[k]));
            });
            const body: Doc = [flatSline, docs, tail];
            if (sourceMultiline || comments.length > 0) return [openDoc, indent([hardline, docs, tail]), hardline, closeDoc];
            return group([openDoc, indent(body), flatSline, closeDoc]);
        }

        const sepType = SEMI_LISTS.has(parentKind) ? L.SEMI : L.COMMA;
        const split = this.splitOn(inner, sepType);
        let items = split.items;
        let trailingTok: TerminalNode | null = null;
        if (items.length > 1 && items[items.length - 1].length === 0) {
            items = items.slice(0, -1);
            trailingTok = split.seps[split.seps.length - 1];
        }
        const docs = items.map((it) => this.seq(it.length > 0 ? [this.ls(it[0]), ...it.slice(1)] : it, parentKind));
        const sepDocs = split.seps.slice(0, docs.length - 1).map((t) => this.tok(t));

        // Hug a final brace-closed argument (`f(a, x -> {...})`). Decided from the syntax alone, never
        // from how a doc happens to break, so that a second formatting pass changes nothing.
        const lastItem = items[items.length - 1];
        const lastTok = lastItem.length > 0 ? lastTerm(lastItem[lastItem.length - 1]) : null;
        const huggable =
            !pad && comments.length === 0 && sepType === L.COMMA && lastTok !== null && ttype(lastTok) === L.RBRACE &&
            !items.slice(0, -1).some((it) => it.length > 0 && lastTerm(it[it.length - 1]) !== null && ttype(lastTerm(it[it.length - 1])!) === L.RBRACE) &&
            !docs.slice(0, -1).some(willBreak);
        if (huggable) return [openDoc, this.joinWithSeps(docs, sepDocs, " "), closeDoc];

        const list: Doc[] = this.joinWithSeps(docs, sepDocs, this.flat > 0 ? " " : line);
        if (trailingTok) {
            const ti = this.info(trailingTok);
            const quiet = !ti || (ti.lead.length === 0 && ti.trail.length === 0);
            list.push(quiet ? ifBreak(this.src(trailingTok), "") : this.tok(trailingTok));
        }
        list.push(...tail);
        const forceBreak =
            pad && ot === L.LBRACE && this.flat === 0 && inner.length > 0 && !!firstTerm(inner[0]) &&
            firstTerm(inner[0])!.symbol.line > open.symbol.line;
        return group([openDoc, indent([flatSline, list]), flatSline, closeDoc], { shouldBreak: forceBreak || comments.length > 0 });
    }

    // ------------------------------------------------------------- dispatch

    print(n: Node): Doc {
        if (isTerm(n)) return this.tok(n);
        const k = kind(n);
        if (EQ_BODY.has(k) && this.hasBodyArrow(n)) return this.printEqBody(n);
        if (BINARY.has(k)) return this.printBinary(n);
        switch (k) {
            case "CompilationUnit": return this.printUnit(n);
            case "Statement": return this.printStatement(n);
            case "Block": return this.printBlock(n);
            case "IfExpr": return this.printIf(n);
            case "DeclPrefix": return this.seq(kids(n), k);
            case "AnnotationList": return this.printAnnotations(n);
            case "ModifierList": return [join(" ", kids(n).map((m) => this.print(m))), " "];
            case "PlainString":
            case "InterpolatedString": return this.printString(n);
            case "DebugPrimary": return kids(n).map((c) => this.print(c));
            default: return this.seq(kids(n), k);
        }
    }

    printRoot(): Doc {
        return this.print(this.root.tree);
    }

    private printUnit(n: ParserRuleContext): Doc {
        const cs = kids(n);
        const eof = cs[cs.length - 1] as TerminalNode;
        const items = cs.slice(0, -1);
        const itemDocs = items.map((it) => this.print(this.ls(it)));
        const docs: Doc[] = [];
        items.forEach((it, k) => {
            if (k > 0) {
                const prev = items[k - 1];
                const blank = this.blankBefore(firstTerm(it)) || kind(prev) !== kind(it);
                docs.push(hardline);
                if (blank) docs.push(hardline);
            }
            docs.push(itemDocs[k]);
        });
        const info = this.info(eof);
        if (info && info.lead.length > 0) {
            if (items.length > 0) {
                docs.push(hardline);
                if (this.blankBefore(eof)) docs.push(hardline);
            }
            info.lead.forEach((c, i) => {
                if (i > 0) docs.push(hardline, ...(c.nl >= 2 ? [hardline] : []));
                docs.push(this.commentText(c));
            });
        }
        if (info) docs.push(...this.trailDoc(info));
        return docs.length > 0 ? [docs, hardline] : "";
    }

    // ------------------------------------------------------------ statements

    private statementParts(n: ParserRuleContext): { expr: Node; semi: TerminalNode | null }[] {
        const cs = kids(n);
        const parts: { expr: Node; semi: TerminalNode | null }[] = [];
        for (const c of cs) {
            if (isTerm(c)) {
                if (parts.length > 0) parts[parts.length - 1].semi = c;
            } else {
                parts.push({ expr: c, semi: null });
            }
        }
        return parts;
    }

    private printParts(parts: { expr: Node; semi: TerminalNode | null }[], from: number): Doc[] {
        const out: Doc[] = [];
        for (let k = from; k < parts.length; k++) {
            if (k > from) {
                out.push(hardline);
                if (this.blankBefore(firstTerm(parts[k].expr))) out.push(hardline);
            }
            out.push(this.print(this.ls(parts[k].expr)));
            if (parts[k].semi) out.push(this.tok(parts[k].semi!));
        }
        return out;
    }

    private printStatement(n: ParserRuleContext): Doc {
        return this.printParts(this.statementParts(n), 0);
    }

    private isMultiStatement(n: ParserRuleContext): boolean {
        const parts = this.statementParts(n);
        return parts.length > 1 || (parts.length === 1 && ["LetExpr", "LocalDefExpr", "UseExpr"].includes(kind(parts[0].expr)));
    }

    private printBlock(n: ParserRuleContext): Doc {
        const cs = kids(n);
        const open = cs[0] as TerminalNode;
        const close = cs[cs.length - 1] as TerminalNode;
        const stmt = cs.length === 3 ? (cs[1] as ParserRuleContext) : null;
        const comments = this.takeClosingComments(close);
        if (!stmt && comments.length === 0) return [this.tok(open), this.tok(close)];
        const body: Doc[] = [];
        if (stmt) body.push(this.print(stmt));
        body.push(...comments.flatMap((c) => (stmt || body.length > 0 ? [hardline, c] : [c])));
        const vertical =
            comments.length > 0 ||
            open.symbol.line !== close.symbol.line ||
            (stmt !== null && this.isMultiStatement(stmt));
        if (vertical) return [this.tok(open), indent([hardline, body]), hardline, this.tok(close)];
        return group([this.tok(open), indent([line, body]), line, this.tok(close)]);
    }

    // --------------------------------------------------------------- if / body

    private isBlockExpr(n: Node): boolean {
        const cs = kids(n);
        if (kind(n) === "PrimaryExpression" && cs.length === 1) return this.isBlockExpr(cs[0]);
        if (kind(n) === "BlockPrimary") return true;
        if (kind(n) === "Expr" || kind(n) === "PrimaryExpr") return cs.length === 1 && this.isBlockExpr(cs[0]);
        return false;
    }

    private printIf(n: ParserRuleContext): Doc {
        const cs = kids(n);
        // IF LPAREN expr RPAREN expr (ELSE expr)?
        const head: Doc = [this.tok(cs[0] as TerminalNode), " ", this.delimited(cs, 1, 3, "IfExpr")];
        const thenNode = cs[4];
        const elseTok = cs[5] as TerminalNode | undefined;
        const elseNode = cs[6];
        const thenHug = this.isBlockExpr(thenNode);
        const thenDoc = this.print(thenHug ? thenNode : this.ls(thenNode));
        const hugs = (e: Node) => this.isBlockExpr(e) || kind(e) === "IfExpr";
        if (this.isBlockExpr(thenNode)) {
            const parts: Doc[] = [head, " ", thenDoc];
            if (elseTok) {
                parts.push(" ", this.tok(elseTok));
                const elseDoc = this.print(hugs(elseNode) ? elseNode : this.ls(elseNode));
                parts.push(hugs(elseNode) ? [" ", elseDoc] : group(indent([line, elseDoc])));
            }
            return parts;
        }
        const parts: Doc[] = [head, indent([line, thenDoc])];
        if (elseTok) {
            const elseDoc = this.print(hugs(elseNode) ? elseNode : this.ls(elseNode));
            parts.push(line, this.tok(elseTok), hugs(elseNode) ? [" ", elseDoc] : indent([line, elseDoc]));
        }
        return group(parts);
    }

    private hasBodyArrow(n: ParserRuleContext): boolean {
        return kids(n).some((c) => isTerm(c) && BODY_ARROWS.has(ttype(c)));
    }

    /** Places `body` after `arrow`: hugged on the arrow's line when it spans lines, else wrapped. */
    private placeBody(body: Node, arrow: TerminalNode): Doc {
        const f = firstTerm(body);
        const l = lastTerm(body);
        const sameLine = !!f && f.symbol.line === arrow.symbol.line;
        // Hug when the author kept the body on the arrow's line and it closes with a brace.
        if (sameLine && l !== null && ttype(l) === L.RBRACE) return [" ", this.print(body)];
        const d = this.print(this.ls(body));
        if (sameLine && willBreak(d)) return [" ", d];
        return group(indent([line, d]));
    }

    /** `head = body`, `case p => body`, `x -> body`; `let` and local `def` own the rest of their block. */
    private printEqBody(n: ParserRuleContext): Doc {
        const cs = kids(n);
        const k = kind(n);
        const ai = cs.findIndex((c) => isTerm(c) && BODY_ARROWS.has(ttype(c)));
        const arrow = cs[ai] as TerminalNode;
        const head = [this.seq(cs.slice(0, ai), k), " ", this.tok(arrow)];
        const body = cs[ai + 1];
        const rest = cs.slice(ai + 2);
        const restDoc = rest.length > 0 ? this.seq(rest, k) : "";
        const comma = rest.length > 0 && isTerm(rest[0]) && ttype(rest[0] as TerminalNode) === L.COMMA;
        const tailDoc: Doc = rest.length > 0 ? (comma ? restDoc : [" ", restDoc]) : "";

        if (kind(body) !== "Statement") return [head, this.placeBody(body, arrow), tailDoc];

        const stmt = body as ParserRuleContext;
        const parts = this.statementParts(stmt);
        if (k === "LetExpr" || k === "LocalDefExpr") {
            // The statement is the remainder of the enclosing block: only its first expression
            // belongs to this binding.
            const first = parts[0];
            const out: Doc[] = [head, this.placeBody(first.expr, arrow)];
            if (first.semi) out.push(this.tok(first.semi));
            if (parts.length > 1) out.push(hardline, ...this.restSeparator(parts[1].expr), ...this.printParts(parts, 1));
            return [out, tailDoc];
        }
        if (this.isMultiStatement(stmt)) return [head, indent([hardline, this.printStatement(stmt)]), tailDoc];
        const only = parts[0];
        const out: Doc[] = [head, this.placeBody(only.expr, arrow)];
        if (only.semi) out.push(this.tok(only.semi));
        return [out, tailDoc];
    }

    private restSeparator(next: Node): Doc[] {
        return this.blankBefore(firstTerm(next)) ? [hardline] : [];
    }

    // --------------------------------------------------------------- operators

    private printBinary(n: ParserRuleContext): Doc {
        const k = kind(n);
        const rightAssoc = k === "ConsExpr";
        const operands: Node[] = [];
        const ops: Node[] = [];
        const collect = (m: ParserRuleContext): void => {
            const [l, op, r] = kids(m);
            if (rightAssoc) {
                operands.push(l);
                ops.push(op);
                if (kind(r) === k) collect(r as ParserRuleContext);
                else operands.push(r);
            } else {
                if (kind(l) === k) collect(l as ParserRuleContext);
                else operands.push(l);
                ops.push(op);
                operands.push(r);
            }
        };
        collect(n);
        const rest: Doc[] = ops.map((op, i) => [" ", this.print(op), this.flat > 0 ? " " : line, this.print(this.ls(operands[i + 1]))]);
        return group([this.print(operands[0]), indent(rest)]);
    }

    // ------------------------------------------------------- annotations, strings

    private printAnnotations(n: ParserRuleContext): Doc {
        const anns = kids(n);
        const out: Doc[] = [];
        anns.forEach((a, i) => {
            out.push(this.print(a));
            const next = i + 1 < anns.length ? firstTerm(anns[i + 1]) : nextTerm(n);
            out.push(this.onNewLine(next) ? hardline : " ");
        });
        return out;
    }

    private printString(n: ParserRuleContext): Doc {
        const out: Doc[] = [];
        for (const c of kids(n)) {
            if (isTerm(c)) {
                out.push(this.tok(c));
            } else {
                this.flat++;
                out.push(this.print(c));
                this.flat--;
            }
        }
        return out;
    }
}
