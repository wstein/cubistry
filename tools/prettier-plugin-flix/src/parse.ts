import {
    BailErrorStrategy,
    BaseErrorListener,
    CharStream,
    CommonTokenStream,
    ParseCancellationException,
    type ParserRuleContext,
    PredictionMode,
    type RecognitionException,
    type Recognizer,
    type Token,
} from "antlr4ng";
import { FlixLexer } from "./generated/FlixLexer.js";
import { FlixParser } from "./generated/FlixParser.js";

/** A `//`, `///` or block comment captured from the hidden channels. */
export interface Comment {
    text: string;
    /** `//` and `///` comments run to the end of the line. */
    isLine: boolean;
    /** Newlines between the previous element (token or comment) and this comment. */
    nl: number;
    /** Newlines between this comment and the next element (comment or token). */
    nlNext: number;
}

/** Comments and line-break facts around one default-channel token. */
export interface TokenInfo {
    /** Comments that start on the same line as the previous token (printed after it). */
    trail: Comment[];
    /** Own-line comments printed before this token. */
    lead: Comment[];
    /** Newlines between the last comment (or previous token) and this token. */
    nlAfter: number;
    /** Newlines between the previous default-channel token and this token. */
    nlBefore: number;
}

export interface FlixRoot {
    type: "flix-root";
    tree: ParserRuleContext;
    text: string;
    /** Source split into code points: ANTLR token offsets count code points, not UTF-16 units. */
    codePoints: string[];
    info: Map<number, TokenInfo>;
    start: number;
    end: number;
}

class FlixSyntaxError extends SyntaxError {
    loc: { start: { line: number; column: number } };
    constructor(message: string, line: number, column: number) {
        super(message);
        this.loc = { start: { line, column: column + 1 } };
    }
}

function countNewlines(s: string): number {
    let n = 0;
    for (let i = 0; i < s.length; i++) {
        if (s.charCodeAt(i) === 10) n++;
    }
    return n;
}

const STAYS_WITH_PREVIOUS = new Set<number>([
    FlixLexer.COMMA, FlixLexer.SEMI, FlixLexer.RPAREN, FlixLexer.RBRACK, FlixLexer.COLON,
    FlixLexer.LPAREN, FlixLexer.LBRACK, FlixLexer.DOT, FlixLexer.DOT_WS, FlixLexer.EOF,
]);

function buildTokenInfo(tokens: Token[]): Map<number, TokenInfo> {
    const info = new Map<number, TokenInfo>();
    let prevDefault: Token | null = null;
    let pending: Comment[] = [];
    let nl = 0;

    for (const t of tokens) {
        if (t.channel === 0) {
            const trail: Comment[] = [];
            let lead = pending;
            if (prevDefault !== null) {
                let k = 0;
                while (k < lead.length && lead[k].nl === 0) k++;
                // `a /* c */ b`: an inline block comment leads the next token, unless that token
                // is punctuation that hugs its left neighbor.
                const hugs = STAYS_WITH_PREVIOUS.has(t.type);
                while (k > 0 && !hugs && !lead[k - 1].isLine && lead[k - 1].nlNext === 0) k--;
                trail.push(...lead.slice(0, k));
                lead = lead.slice(k);
            }
            pending.forEach((c, i) => {
                c.nlNext = i + 1 < pending.length ? pending[i + 1].nl : nl;
            });
            let nlBefore = nl;
            for (const c of pending) nlBefore += c.nl;
            info.set(t.tokenIndex, { trail: [], lead, nlAfter: nl, nlBefore });
            if (prevDefault !== null) {
                const prev = info.get(prevDefault.tokenIndex)!;
                prev.trail = trail;
            }
            prevDefault = t;
            pending = [];
            nl = 0;
        } else if (t.type === FlixLexer.WS) {
            nl += countNewlines(t.text ?? "");
        } else if (
            t.type === FlixLexer.LINE_COMMENT ||
            t.type === FlixLexer.DOC_COMMENT ||
            t.type === FlixLexer.BLOCK_COMMENT
        ) {
            pending.push({
                text: (t.text ?? "").replace(/[ \t\r]+$/, ""),
                isLine: t.type !== FlixLexer.BLOCK_COMMENT,
                nl,
                nlNext: 0,
            });
            nl = 0;
        }
    }
    return info;
}

export function parseFlix(text: string): FlixRoot {
    let firstError: FlixSyntaxError | null = null;
    const listener = new (class extends BaseErrorListener {
        override syntaxError<S extends Token, T extends object>(
            _recognizer: Recognizer<any>,
            _offendingSymbol: S | null,
            line: number,
            column: number,
            msg: string,
            _e: RecognitionException | null,
        ): void {
            void (null as unknown as T);
            firstError ??= new FlixSyntaxError(msg, line, column);
        }
    })();

    const lexer = new FlixLexer(CharStream.fromString(text));
    lexer.removeErrorListeners();
    lexer.addErrorListener(listener);
    const stream = new CommonTokenStream(lexer);
    stream.fill();
    if (firstError) throw firstError;

    // Two-stage parse: SLL prediction without error recovery is two orders of magnitude faster
    // and gives the same tree whenever it succeeds; fall back to full LL for the rest, which
    // also produces the syntax error report.
    let tree: ParserRuleContext;
    try {
        const fast = new FlixParser(stream);
        fast.removeErrorListeners();
        fast.errorHandler = new BailErrorStrategy();
        fast.interpreter.predictionMode = PredictionMode.SLL;
        tree = fast.compilationUnit();
    } catch (e) {
        if (!(e instanceof ParseCancellationException)) throw e;
        stream.seek(0);
        const parser = new FlixParser(stream);
        parser.removeErrorListeners();
        parser.addErrorListener(listener);
        tree = parser.compilationUnit();
        if (firstError) throw firstError;
    }

    return {
        type: "flix-root",
        tree,
        text,
        codePoints: Array.from(text),
        info: buildTokenInfo(stream.getTokens()),
        start: 0,
        end: text.length,
    };
}
